import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  StockMovementType,
  TransferProofStatus,
} from '@prisma/client';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { ConfirmTransferProofDto } from './payment.dto';
import { PrismaService } from './prisma.service';

type MercadoPagoPreference = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

type MercadoPagoPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount: number;
  currency_id: string;
};

type WebhookInput = {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  body: Record<string, unknown>;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createMercadoPagoPreference(orderToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicToken: orderToken },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    if (
      order.paymentMethod !== PaymentMethod.CARD &&
      order.paymentMethod !== PaymentMethod.PAYMENT_LINK
    ) {
      throw new BadRequestException('La orden no usa Mercado Pago.');
    }
    if (order.paymentStatus === PaymentStatus.APPROVED) {
      throw new ConflictException('La orden ya esta pagada.');
    }

    const payment = order.payments.find(
      (entry) => entry.provider === PaymentProvider.MERCADO_PAGO,
    );
    if (!payment) throw new NotFoundException('Registro de pago no encontrado.');
    if (payment.checkoutUrl) {
      return {
        preferenceId: payment.providerPreferenceId,
        checkoutUrl: payment.checkoutUrl,
      };
    }

    const publicApiUrl = this.requireConfig('PUBLIC_API_URL').replace(/\/$/, '');
    const webAppUrl = this.requireConfig('WEB_APP_URL').replace(/\/$/, '');
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requireConfig('MERCADOPAGO_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: order.items.map((item) => ({
          id: item.sku,
          title: `${item.productName} - ${item.variantName}`,
          description: [item.concentrationLabel, item.volumeMl ? `${item.volumeMl} ml` : null]
            .filter(Boolean)
            .join(' '),
          picture_url: item.imageUrl ?? undefined,
          quantity: item.quantity,
          currency_id: order.currency,
          unit_price: item.unitPriceCents / 100,
        })),
        payer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: { number: order.customerPhone },
        },
        external_reference: order.publicToken,
        notification_url: `${publicApiUrl}/api/v1/payments/mercado-pago/webhook`,
        back_urls: {
          success: `${webAppUrl}/pago/exito?order=${order.publicToken}`,
          pending: `${webAppUrl}/pago/pendiente?order=${order.publicToken}`,
          failure: `${webAppUrl}/pago/error?order=${order.publicToken}`,
        },
        auto_return: 'approved',
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadGatewayException(`Mercado Pago rechazo la preferencia: ${detail.slice(0, 300)}`);
    }

    const preference = (await response.json()) as MercadoPagoPreference;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPreferenceId: preference.id,
        checkoutUrl: preference.init_point,
        providerResponse: preference as Prisma.InputJsonValue,
      },
    });

    return { preferenceId: preference.id, checkoutUrl: preference.init_point };
  }

  async receiveMercadoPagoWebhook(input: WebhookInput) {
    const dataId = input.dataId || this.readDataId(input.body);
    if (!dataId || !input.xSignature || !input.xRequestId) {
      throw new UnauthorizedException('Webhook incompleto.');
    }

    try {
      WebhookSignatureValidator.validate({
        xSignature: input.xSignature,
        xRequestId: input.xRequestId,
        dataId,
        secret: this.requireConfig('MERCADOPAGO_WEBHOOK_SECRET'),
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException('Firma de webhook invalida.');
      }
      throw error;
    }

    const eventType = String(input.body.type ?? 'payment');
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: PaymentProvider.MERCADO_PAGO,
          externalId: dataId,
          eventType,
          action: input.body.action ? String(input.body.action) : null,
          payload: input.body as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw error;
    }

    try {
      const paymentData = await this.fetchMercadoPagoPayment(dataId);
      await this.applyMercadoPagoPayment(paymentData);
      await this.prisma.webhookEvent.update({
        where: {
          provider_externalId_eventType: {
            provider: PaymentProvider.MERCADO_PAGO,
            externalId: dataId,
            eventType,
          },
        },
        data: { processedAt: new Date() },
      });
      return { received: true };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: {
          provider_externalId_eventType: {
            provider: PaymentProvider.MERCADO_PAGO,
            externalId: dataId,
            eventType,
          },
        },
        data: { error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error' },
      });
      throw error;
    }
  }

  instructions(method: PaymentMethod) {
    if (method !== PaymentMethod.CASH && method !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('El metodo no usa instrucciones manuales.');
    }
    return this.prisma.paymentInstruction.findFirst({
      where: { method, isActive: true },
    });
  }

  async confirmTransferProof(orderToken: string, input: ConfirmTransferProofDto) {
    const order = await this.prisma.order.findUnique({
      where: { publicToken: orderToken },
      include: { payments: true },
    });
    if (!order || order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new NotFoundException('Orden de transferencia no encontrada.');
    }
    if (!input.objectKey.startsWith(`transfer-proofs/${order.id}/`)) {
      throw new BadRequestException('El comprobante no pertenece a esta orden.');
    }
    const payment = order.payments.find((entry) => entry.method === PaymentMethod.BANK_TRANSFER);
    if (!payment) throw new NotFoundException('Pago de transferencia no encontrado.');

    return this.prisma.$transaction(async (transaction) => {
      const proof = await transaction.transferProof.create({
        data: {
          paymentId: payment.id,
          objectKey: input.objectKey,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          type: 'TRANSFER_PROOF_RECEIVED',
          aggregateType: 'Payment',
          aggregateId: payment.id,
          payload: { orderId: order.id, paymentId: payment.id, proofId: proof.id },
        },
      });
      return proof;
    });
  }

  async reviewTransferProof(
    proofId: string,
    status: TransferProofStatus,
    notes?: string,
  ) {
    if (status === TransferProofStatus.PENDING_REVIEW) {
      throw new BadRequestException('Selecciona APPROVED o REJECTED.');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const proof = await transaction.transferProof.findUnique({
          where: { id: proofId },
          include: { payment: { include: { order: true } } },
        });
        if (!proof) throw new NotFoundException('Comprobante no encontrado.');
        if (proof.status !== TransferProofStatus.PENDING_REVIEW) {
          throw new ConflictException('El comprobante ya fue revisado.');
        }

        const updated = await transaction.transferProof.update({
          where: { id: proof.id },
          data: { status, reviewNotes: notes?.trim(), reviewedAt: new Date() },
        });
        if (status === TransferProofStatus.APPROVED) {
          await this.confirmOrderPayment(
            transaction,
            proof.payment.orderId,
            proof.payment.id,
          );
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async confirmCashPayment(orderToken: string) {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { publicToken: orderToken },
          include: { payments: true },
        });
        if (!order || order.paymentMethod !== PaymentMethod.CASH) {
          throw new NotFoundException('Orden de efectivo no encontrada.');
        }
        const payment = order.payments.find((entry) => entry.method === PaymentMethod.CASH);
        if (!payment) throw new NotFoundException('Pago en efectivo no encontrado.');
        await this.confirmOrderPayment(transaction, order.id, payment.id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { confirmed: true, orderToken };
  }

  private async fetchMercadoPagoPayment(paymentId: string) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.requireConfig('MERCADOPAGO_ACCESS_TOKEN')}`,
      },
    });
    if (!response.ok) {
      throw new BadGatewayException('No fue posible consultar el pago en Mercado Pago.');
    }
    return (await response.json()) as MercadoPagoPayment;
  }

  private async applyMercadoPagoPayment(paymentData: MercadoPagoPayment) {
    if (!paymentData.external_reference) {
      throw new BadRequestException('El pago no contiene una referencia de orden.');
    }
    const order = await this.prisma.order.findUnique({
      where: { publicToken: paymentData.external_reference },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('La orden del pago no existe.');
    if (
      Math.round(paymentData.transaction_amount * 100) !== order.totalCents ||
      paymentData.currency_id !== order.currency
    ) {
      throw new ConflictException('El monto o la moneda del pago no coincide con la orden.');
    }

    const mappedStatus = this.mapMercadoPagoStatus(paymentData.status);
    await this.prisma.$transaction(
      async (transaction) => {
        const payment = order.payments.find(
          (entry) => entry.provider === PaymentProvider.MERCADO_PAGO,
        );
        if (!payment) throw new NotFoundException('Registro de pago no encontrado.');

        await transaction.payment.update({
          where: { id: payment.id },
          data: {
            status: mappedStatus,
            providerPaymentId: String(paymentData.id),
            statusDetail: paymentData.status_detail,
            providerResponse: paymentData as Prisma.InputJsonValue,
            approvedAt: mappedStatus === PaymentStatus.APPROVED ? new Date() : undefined,
          },
        });

        if (mappedStatus === PaymentStatus.APPROVED && order.paymentStatus !== PaymentStatus.APPROVED) {
          await this.confirmOrderPayment(transaction, order.id, payment.id);
        } else if (order.paymentStatus !== PaymentStatus.APPROVED) {
          await transaction.order.update({
            where: { id: order.id },
            data: { paymentStatus: mappedStatus },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private mapMercadoPagoStatus(status: string) {
    const statuses: Record<string, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      in_process: PaymentStatus.IN_PROCESS,
      approved: PaymentStatus.APPROVED,
      rejected: PaymentStatus.REJECTED,
      cancelled: PaymentStatus.CANCELLED,
      refunded: PaymentStatus.REFUNDED,
      charged_back: PaymentStatus.CHARGED_BACK,
    };
    return statuses[status] ?? PaymentStatus.PENDING;
  }

  private async confirmOrderPayment(
    transaction: Prisma.TransactionClient,
    orderId: string,
    paymentId: string,
  ) {
    const order = await transaction.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    if (order.paymentStatus === PaymentStatus.APPROVED) return;
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED) {
      throw new ConflictException('La reserva de la orden ya no esta activa.');
    }

    const reservations = await transaction.inventoryReservation.findMany({
      where: { orderItem: { orderId }, status: ReservationStatus.ACTIVE },
    });
    if (!reservations.length) {
      throw new ConflictException('La orden no tiene reservas activas.');
    }

    for (const reservation of reservations) {
      const consumed = await transaction.inventoryLevel.updateMany({
        where: {
          id: reservation.inventoryLevelId,
          reserved: { gte: reservation.quantity },
          onHand: { gte: reservation.quantity },
        },
        data: {
          onHand: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
          version: { increment: 1 },
        },
      });
      if (!consumed.count) {
        throw new ConflictException('No fue posible consumir la reserva de inventario.');
      }
      await transaction.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONSUMED, consumedAt: new Date() },
      });
      await transaction.stockMovement.create({
        data: {
          variantId: reservation.variantId,
          locationId: reservation.locationId,
          type: StockMovementType.SALE,
          quantity: -reservation.quantity,
          referenceId: order.id,
        },
      });
    }

    await transaction.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.APPROVED, approvedAt: new Date() },
    });
    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.APPROVED,
        paidAt: new Date(),
      },
    });
    await transaction.outboxEvent.create({
      data: {
        type: 'PAYMENT_APPROVED',
        aggregateType: 'Order',
        aggregateId: order.id,
        payload: { orderId: order.id, paymentId },
      },
    });
  }

  private readDataId(body: Record<string, unknown>) {
    const data = body.data;
    if (!data || typeof data !== 'object' || !('id' in data)) return undefined;
    return String((data as { id: unknown }).id);
  }

  private requireConfig(name: string) {
    const value = this.config.get<string>(name);
    if (!value) throw new ServiceUnavailableException(`Falta configurar ${name}.`);
    return value;
  }
}
