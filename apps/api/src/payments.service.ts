import { createHash } from 'node:crypto';
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
  Payment,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  ShippingQuoteStatus,
  StockMovementType,
  TransferProofStatus,
} from '@prisma/client';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import Stripe = require('stripe');
import {
  ConfirmTransferProofDto,
  ProcessMercadoPagoCardDto,
} from './payment.dto';
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
  metadata?: {
    payment_id?: string;
    paymentId?: string;
  };
};

type CardOrder = Prisma.OrderGetPayload<{
  include: { items: true; payments: true };
}>;

type WebhookInput = {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  body: Record<string, unknown>;
};

type OrderReservationState = 'ACTIVE' | 'FINALIZED' | 'INACTIVE';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  paymentConfiguration() {
    const mercadoPagoPublicKey = this.config.get<string>('MERCADOPAGO_PUBLIC_KEY')?.trim();
    const mercadoPagoAccessToken = this.config
      .get<string>('MERCADOPAGO_ACCESS_TOKEN')
      ?.trim();
    const mercadoPagoWebhookSecret = this.config
      .get<string>('MERCADOPAGO_WEBHOOK_SECRET')
      ?.trim();
    const stripePublishableKey = this.config.get<string>('STRIPE_PUBLISHABLE_KEY')?.trim();
    const mercadoPagoCardEnabled = Boolean(
      mercadoPagoPublicKey &&
        mercadoPagoAccessToken &&
        mercadoPagoWebhookSecret,
    );
    return {
      mercadoPago: {
        enabled: mercadoPagoCardEnabled,
        cardEnabled: mercadoPagoCardEnabled,
        linkEnabled: Boolean(mercadoPagoAccessToken && mercadoPagoWebhookSecret),
        publicKey: mercadoPagoPublicKey || null,
      },
      stripe: {
        enabled: Boolean(
          stripePublishableKey &&
            this.config.get<string>('STRIPE_SECRET_KEY') &&
            this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
        ),
        publishableKey: stripePublishableKey || null,
      },
    };
  }

  async createMercadoPagoPreference(orderToken: string, customerId: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicToken: orderToken, customerId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    this.assertShippingQuoteReady(order);
    if (order.paymentMethod !== PaymentMethod.PAYMENT_LINK) {
      throw new BadRequestException('La orden no usa link de Mercado Pago.');
    }
    if (order.paymentStatus === PaymentStatus.APPROVED) {
      throw new ConflictException('La orden ya esta pagada.');
    }

    const payment = order.payments.find(
      (entry) =>
        entry.provider === PaymentProvider.MERCADO_PAGO &&
        entry.method === PaymentMethod.PAYMENT_LINK &&
        !this.isSupersededPaymentStatus(entry.status),
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
        metadata: { payment_id: payment.id },
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

  async processMercadoPagoCard(
    orderToken: string,
    input: ProcessMercadoPagoCardDto,
    customerId: string,
  ) {
    const order = await this.getOwnedCardOrder(
      orderToken,
      customerId,
      PaymentProvider.MERCADO_PAGO,
    );
    const payment = this.cardPayment(order, PaymentProvider.MERCADO_PAGO);
    const publicApiUrl = this.requireConfig('PUBLIC_API_URL').replace(/\/$/, '');
    const idempotencyKey = createHash('sha256')
      .update(`${payment.id}:${input.token}`)
      .digest('hex');
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.requireConfig('MERCADOPAGO_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: order.totalCents / 100,
        token: input.token,
        description: `Pedido ${order.number}`,
        installments: input.installments,
        payment_method_id: input.payment_method_id,
        issuer_id: input.issuer_id || undefined,
        payer: {
          email: order.customerEmail,
          identification: input.payer.identification,
        },
        external_reference: order.publicToken,
        metadata: { payment_id: payment.id },
        notification_url: `${publicApiUrl}/api/v1/payments/mercado-pago/webhook`,
        statement_descriptor: 'KIIBOK',
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadGatewayException(
        `Mercado Pago rechazo el pago: ${this.providerError(detail)}`,
      );
    }

    const paymentData = (await response.json()) as MercadoPagoPayment;
    const effectiveStatus = await this.applyMercadoPagoPayment(paymentData);
    return {
      paymentId: String(paymentData.id),
      status: effectiveStatus,
      statusDetail: paymentData.status_detail ?? null,
    };
  }

  async createStripePaymentIntent(orderToken: string, customerId: string) {
    const order = await this.getOwnedCardOrder(
      orderToken,
      customerId,
      PaymentProvider.STRIPE,
    );
    const payment = this.cardPayment(order, PaymentProvider.STRIPE);
    const stripe = this.stripeClient();

    if (payment.providerPaymentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(
        payment.providerPaymentId,
      );
      if (!existingIntent.client_secret) {
        throw new BadGatewayException('Stripe no devolvio el secreto de la sesion.');
      }
      return {
        clientSecret: existingIntent.client_secret,
        paymentIntentId: existingIntent.id,
      };
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: order.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        description: `Pedido ${order.number}`,
        receipt_email: order.customerEmail,
        metadata: {
          orderId: order.id,
          orderToken: order.publicToken,
          paymentId: payment.id,
        },
      },
      { idempotencyKey: payment.id },
    );
    if (!intent.client_secret) {
      throw new BadGatewayException('Stripe no devolvio el secreto de la sesion.');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: intent.id,
        providerResponse: intent as unknown as Prisma.InputJsonValue,
      },
    });
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
  }

  async syncStripePayment(orderToken: string, customerId: string) {
    const order = await this.getOwnedCardOrder(
      orderToken,
      customerId,
      PaymentProvider.STRIPE,
      true,
    );
    const payment = this.cardPayment(order, PaymentProvider.STRIPE);
    if (!payment.providerPaymentId) {
      throw new ConflictException('El pago de Stripe aun no ha sido iniciado.');
    }
    const intent = await this.stripeClient().paymentIntents.retrieve(
      payment.providerPaymentId,
    );
    const effectiveStatus = await this.applyStripePaymentIntent(intent);
    return {
      status: effectiveStatus,
      statusDetail: intent.last_payment_error?.code ?? null,
    };
  }

  async receiveStripeWebhook(rawBody: Buffer | undefined, signature?: string) {
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Webhook de Stripe incompleto.');
    }
    let event: Stripe.Event;
    try {
      event = this.stripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        this.requireConfig('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new UnauthorizedException('Firma de webhook de Stripe invalida.');
    }

    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: PaymentProvider.STRIPE,
          externalId: event.id,
          eventType: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw error;
    }

    try {
      if (event.type.startsWith('payment_intent.')) {
        await this.applyStripePaymentIntent(event.data.object as Stripe.PaymentIntent);
      }
      await this.prisma.webhookEvent.update({
        where: {
          provider_externalId_eventType: {
            provider: PaymentProvider.STRIPE,
            externalId: event.id,
            eventType: event.type,
          },
        },
        data: { processedAt: new Date() },
      });
      return { received: true };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: {
          provider_externalId_eventType: {
            provider: PaymentProvider.STRIPE,
            externalId: event.id,
            eventType: event.type,
          },
        },
        data: {
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
        },
      });
      throw error;
    }
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

  async confirmTransferProof(
    orderToken: string,
    input: ConfirmTransferProofDto,
    customerId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { publicToken: orderToken, customerId },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order || order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new NotFoundException('Orden de transferencia no encontrada.');
    }
    this.assertShippingQuoteReady(order);
    if (!input.objectKey.startsWith(`transfer-proofs/${order.id}/`)) {
      throw new BadRequestException('El comprobante no pertenece a esta orden.');
    }
    const privateStorageUrl = this.requireConfig('STORAGE_PRIVATE_URL').replace(/\/$/, '');
    const payment = order.payments.find(
      (entry) =>
        entry.method === PaymentMethod.BANK_TRANSFER &&
        !this.isSupersededPaymentStatus(entry.status),
    );
    if (!payment) throw new NotFoundException('Pago de transferencia no encontrado.');

    return this.prisma.$transaction(async (transaction) => {
      const proof = await transaction.transferProof.create({
        data: {
          paymentId: payment.id,
          objectKey: input.objectKey,
          fileUrl: `${privateStorageUrl}/${input.objectKey}`,
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
          include: { payments: { orderBy: { createdAt: 'desc' } } },
        });
        if (!order || order.paymentMethod !== PaymentMethod.CASH) {
          throw new NotFoundException('Orden de efectivo no encontrada.');
        }
        const payment = order.payments.find(
          (entry) =>
            entry.method === PaymentMethod.CASH &&
            !this.isSupersededPaymentStatus(entry.status),
        );
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
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException('La orden del pago no existe.');
    const payment = this.mercadoPagoPaymentAttempt(order.payments, paymentData);
    if (
      Math.round(paymentData.transaction_amount * 100) !== order.totalCents ||
      paymentData.currency_id !== order.currency ||
      payment.amountCents !== order.totalCents ||
      payment.currency !== order.currency
    ) {
      throw new ConflictException('El monto o la moneda del pago no coincide con la orden.');
    }

    const mappedStatus = this.mapMercadoPagoStatus(paymentData.status);
    if (this.paymentAttemptWasSuperseded(order.payments, payment.id)) {
      return this.handleSupersededMercadoPagoPayment(order.id, payment.id, paymentData, mappedStatus);
    }
    if (mappedStatus === PaymentStatus.APPROVED) {
      const reservationState = await this.orderReservationState(order.id);
      if (reservationState === 'FINALIZED') return PaymentStatus.APPROVED;
      if (reservationState === 'INACTIVE') {
        await this.refundLateMercadoPagoPayment(
          order.id,
          payment.id,
          String(paymentData.id),
          false,
        );
        return PaymentStatus.REFUNDED;
      }
    }

    try {
      const outcome = await this.prisma.$transaction(
        async (transaction) => {
          const currentOrder = await transaction.order.findUnique({
            where: { id: order.id },
            include: { payments: { orderBy: { createdAt: 'desc' } } },
          });
          if (!currentOrder) throw new NotFoundException('La orden del pago no existe.');
          if (this.paymentAttemptWasSuperseded(currentOrder.payments, payment.id)) {
            return 'SUPERSEDED' as const;
          }

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

          if (
            mappedStatus === PaymentStatus.APPROVED &&
            currentOrder.paymentStatus !== PaymentStatus.APPROVED
          ) {
            await this.confirmOrderPayment(transaction, order.id, payment.id);
          } else if (currentOrder.paymentStatus !== PaymentStatus.APPROVED) {
            await transaction.order.update({
              where: { id: order.id },
              data: { paymentStatus: mappedStatus },
            });
          }
          return 'APPLIED' as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (outcome === 'SUPERSEDED') {
        return this.handleSupersededMercadoPagoPayment(
          order.id,
          payment.id,
          paymentData,
          mappedStatus,
        );
      }
    } catch (error) {
      if (mappedStatus === PaymentStatus.APPROVED) {
        const latestPayment = await this.prisma.payment.findUnique({
          where: { id: payment.id },
        });
        if (latestPayment && this.isSupersededPaymentStatus(latestPayment.status)) {
          return this.handleSupersededMercadoPagoPayment(
            order.id,
            payment.id,
            paymentData,
            mappedStatus,
          );
        }
        const reservationState = await this.orderReservationState(order.id);
        if (reservationState === 'FINALIZED') return PaymentStatus.APPROVED;
        if (reservationState === 'INACTIVE') {
          await this.refundLateMercadoPagoPayment(
            order.id,
            payment.id,
            String(paymentData.id),
            false,
          );
          return PaymentStatus.REFUNDED;
        }
      }
      throw error;
    }
    return mappedStatus;
  }

  private async applyStripePaymentIntent(intent: Stripe.PaymentIntent) {
    const orderToken = intent.metadata.orderToken;
    const order = await this.prisma.order.findFirst({
      where: orderToken
        ? { publicToken: orderToken }
        : { payments: { some: { providerPaymentId: intent.id } } },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException('La orden del pago de Stripe no existe.');
    const payment = this.stripePaymentAttempt(order.payments, intent);
    if (
      intent.amount !== order.totalCents ||
      intent.currency.toUpperCase() !== order.currency ||
      payment.amountCents !== order.totalCents ||
      payment.currency !== order.currency
    ) {
      throw new ConflictException('El monto o la moneda de Stripe no coincide con la orden.');
    }
    if (intent.status === 'succeeded' && intent.amount_received !== order.totalCents) {
      throw new ConflictException('Stripe no confirmo el monto total de la orden.');
    }

    const mappedStatus = this.mapStripeStatus(intent.status);
    if (this.paymentAttemptWasSuperseded(order.payments, payment.id)) {
      return this.handleSupersededStripePayment(order.id, payment.id, intent, mappedStatus);
    }
    if (mappedStatus === PaymentStatus.APPROVED) {
      const reservationState = await this.orderReservationState(order.id);
      if (reservationState === 'FINALIZED') return PaymentStatus.APPROVED;
      if (reservationState === 'INACTIVE') {
        await this.refundLateStripePayment(order.id, payment.id, intent.id, false);
        return PaymentStatus.REFUNDED;
      }
    }

    try {
      const outcome = await this.prisma.$transaction(
        async (transaction) => {
          const currentOrder = await transaction.order.findUnique({
            where: { id: order.id },
            include: { payments: { orderBy: { createdAt: 'desc' } } },
          });
          if (!currentOrder) throw new NotFoundException('La orden del pago no existe.');
          if (this.paymentAttemptWasSuperseded(currentOrder.payments, payment.id)) {
            return 'SUPERSEDED' as const;
          }

          await transaction.payment.update({
            where: { id: payment.id },
            data: {
              status: mappedStatus,
              providerPaymentId: intent.id,
              statusDetail: intent.last_payment_error?.code ?? intent.status,
              providerResponse: intent as unknown as Prisma.InputJsonValue,
              approvedAt: mappedStatus === PaymentStatus.APPROVED ? new Date() : undefined,
            },
          });
          if (
            mappedStatus === PaymentStatus.APPROVED &&
            currentOrder.paymentStatus !== PaymentStatus.APPROVED
          ) {
            await this.confirmOrderPayment(transaction, order.id, payment.id);
          } else if (currentOrder.paymentStatus !== PaymentStatus.APPROVED) {
            await transaction.order.update({
              where: { id: order.id },
              data: { paymentStatus: mappedStatus },
            });
          }
          return 'APPLIED' as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (outcome === 'SUPERSEDED') {
        return this.handleSupersededStripePayment(order.id, payment.id, intent, mappedStatus);
      }
    } catch (error) {
      if (mappedStatus === PaymentStatus.APPROVED) {
        const latestPayment = await this.prisma.payment.findUnique({
          where: { id: payment.id },
        });
        if (latestPayment && this.isSupersededPaymentStatus(latestPayment.status)) {
          return this.handleSupersededStripePayment(
            order.id,
            payment.id,
            intent,
            mappedStatus,
          );
        }
        const reservationState = await this.orderReservationState(order.id);
        if (reservationState === 'FINALIZED') return PaymentStatus.APPROVED;
        if (reservationState === 'INACTIVE') {
          await this.refundLateStripePayment(order.id, payment.id, intent.id, false);
          return PaymentStatus.REFUNDED;
        }
      }
      throw error;
    }
    return mappedStatus;
  }

  private mercadoPagoPaymentAttempt(
    payments: Payment[],
    paymentData: MercadoPagoPayment,
  ) {
    const metadataPaymentId =
      paymentData.metadata?.payment_id ?? paymentData.metadata?.paymentId;
    if (metadataPaymentId) {
      const payment = payments.find(
        (entry) =>
          entry.id === metadataPaymentId &&
          entry.provider === PaymentProvider.MERCADO_PAGO,
      );
      if (!payment) {
        throw new ConflictException(
          'El intento indicado por Mercado Pago no pertenece a esta orden.',
        );
      }
      return payment;
    }

    const providerPaymentId = String(paymentData.id);
    const existing = payments.find(
      (entry) =>
        entry.provider === PaymentProvider.MERCADO_PAGO &&
        entry.providerPaymentId === providerPaymentId,
    );
    if (existing) return existing;

    const candidates = payments.filter(
      (entry) => entry.provider === PaymentProvider.MERCADO_PAGO,
    );
    if (candidates.length === 1) return candidates[0];
    throw new ConflictException(
      'No fue posible identificar de forma segura el intento de Mercado Pago.',
    );
  }

  private stripePaymentAttempt(payments: Payment[], intent: Stripe.PaymentIntent) {
    const metadataPaymentId = intent.metadata.paymentId;
    if (metadataPaymentId) {
      const payment = payments.find(
        (entry) =>
          entry.id === metadataPaymentId &&
          entry.provider === PaymentProvider.STRIPE,
      );
      if (!payment) {
        throw new ConflictException(
          'El intento indicado por Stripe no pertenece a esta orden.',
        );
      }
      return payment;
    }

    const existing = payments.find(
      (entry) =>
        entry.provider === PaymentProvider.STRIPE &&
        entry.providerPaymentId === intent.id,
    );
    if (existing) return existing;

    const candidates = payments.filter(
      (entry) => entry.provider === PaymentProvider.STRIPE,
    );
    if (candidates.length === 1) return candidates[0];
    throw new ConflictException(
      'No fue posible identificar de forma segura el intento de Stripe.',
    );
  }

  private paymentAttemptWasSuperseded(payments: Payment[], paymentId: string) {
    const selected = payments.find((entry) => entry.id === paymentId);
    if (!selected || this.isSupersededPaymentStatus(selected.status)) return true;
    const current = payments.find(
      (entry) => !this.isSupersededPaymentStatus(entry.status),
    );
    return !current || current.id !== paymentId;
  }

  private async handleSupersededMercadoPagoPayment(
    orderId: string,
    paymentId: string,
    paymentData: MercadoPagoPayment,
    mappedStatus: PaymentStatus,
  ) {
    if (mappedStatus === PaymentStatus.APPROVED) {
      await this.refundLateMercadoPagoPayment(
        orderId,
        paymentId,
        String(paymentData.id),
        true,
      );
      return PaymentStatus.REFUNDED;
    }
    await this.recordSupersededProviderState(
      paymentId,
      String(paymentData.id),
      mappedStatus,
      paymentData.status_detail ?? paymentData.status,
      paymentData as Prisma.InputJsonValue,
    );
    return mappedStatus === PaymentStatus.REFUNDED ||
      mappedStatus === PaymentStatus.CHARGED_BACK
      ? mappedStatus
      : PaymentStatus.CANCELLED;
  }

  private async handleSupersededStripePayment(
    orderId: string,
    paymentId: string,
    intent: Stripe.PaymentIntent,
    mappedStatus: PaymentStatus,
  ) {
    if (mappedStatus === PaymentStatus.APPROVED) {
      await this.refundLateStripePayment(orderId, paymentId, intent.id, true);
      return PaymentStatus.REFUNDED;
    }
    await this.recordSupersededProviderState(
      paymentId,
      intent.id,
      mappedStatus,
      intent.last_payment_error?.code ?? intent.status,
      intent as unknown as Prisma.InputJsonValue,
    );
    return mappedStatus === PaymentStatus.REFUNDED ||
      mappedStatus === PaymentStatus.CHARGED_BACK
      ? mappedStatus
      : PaymentStatus.CANCELLED;
  }

  private async recordSupersededProviderState(
    paymentId: string,
    providerPaymentId: string,
    providerStatus: PaymentStatus,
    providerDetail: string,
    providerResponse: Prisma.InputJsonValue,
  ) {
    const status =
      providerStatus === PaymentStatus.REFUNDED ||
      providerStatus === PaymentStatus.CHARGED_BACK
        ? providerStatus
        : PaymentStatus.CANCELLED;
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        providerPaymentId,
        statusDetail: `superseded_attempt:${providerDetail}`.slice(0, 255),
        providerResponse,
        approvedAt: null,
      },
    });
  }

  private async orderReservationState(orderId: string): Promise<OrderReservationState> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, expiresAt: true },
    });
    const initialState = this.classifyOrderReservation(order);
    if (initialState !== 'ACTIVE') return initialState;

    const activeReservations = await this.prisma.inventoryReservation.count({
      where: { orderItem: { orderId }, status: ReservationStatus.ACTIVE },
    });
    if (activeReservations > 0) return 'ACTIVE';

    // The webhook and the browser can confirm the same PaymentIntent concurrently.
    // Re-read the order because the other request may have consumed the reservation.
    const latestOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, paymentStatus: true, expiresAt: true },
    });
    const latestState = this.classifyOrderReservation(latestOrder);
    return latestState === 'ACTIVE' ? 'INACTIVE' : latestState;
  }

  private classifyOrderReservation(
    order: {
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      expiresAt: Date | null;
    } | null,
  ): OrderReservationState {
    if (!order) return 'INACTIVE';
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED) {
      return 'INACTIVE';
    }
    if (order.paymentStatus === PaymentStatus.APPROVED) return 'FINALIZED';
    if (order.expiresAt && order.expiresAt <= new Date()) return 'INACTIVE';
    return 'ACTIVE';
  }

  private async refundLateMercadoPagoPayment(
    orderId: string,
    paymentId: string,
    providerPaymentId: string,
    preserveOrder: boolean,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (
      !payment ||
      payment.orderId !== orderId ||
      payment.provider !== PaymentProvider.MERCADO_PAGO
    ) {
      throw new NotFoundException('Registro de pago no encontrado.');
    }
    if (payment.status === PaymentStatus.REFUNDED) return;

    const idempotencyKey = createHash('sha256')
      .update(`late-payment-refund:${payment.id}:${providerPaymentId}`)
      .digest('hex');
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${providerPaymentId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.requireConfig('MERCADOPAGO_ACCESS_TOKEN')}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: '{}',
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new BadGatewayException(
        `No fue posible reembolsar el pago expirado: ${this.providerError(detail)}`,
      );
    }
    const refund = (await response.json()) as Prisma.InputJsonValue;
    await this.markLatePaymentRefunded(
      orderId,
      payment.id,
      providerPaymentId,
      refund,
      preserveOrder,
    );
  }

  private async refundLateStripePayment(
    orderId: string,
    paymentId: string,
    providerPaymentId: string,
    preserveOrder: boolean,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (
      !payment ||
      payment.orderId !== orderId ||
      payment.provider !== PaymentProvider.STRIPE
    ) {
      throw new NotFoundException('Registro de Stripe no encontrado.');
    }
    if (payment.status === PaymentStatus.REFUNDED) return;

    const refund = await this.stripeClient().refunds.create(
      {
        payment_intent: providerPaymentId,
        metadata: {
          orderId,
          paymentId,
          reason: preserveOrder
            ? 'payment_method_changed'
            : 'order_reservation_expired',
        },
      },
      { idempotencyKey: `late-payment-refund-${payment.id}` },
    );
    await this.markLatePaymentRefunded(
      orderId,
      payment.id,
      providerPaymentId,
      refund as unknown as Prisma.InputJsonValue,
      preserveOrder,
    );
  }

  private async markLatePaymentRefunded(
    orderId: string,
    paymentId: string,
    providerPaymentId: string,
    providerResponse: Prisma.InputJsonValue,
    preserveOrder: boolean,
  ) {
    const updates: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          providerPaymentId,
          statusDetail: preserveOrder
            ? 'automatic_refund_after_payment_method_changed'
            : 'automatic_refund_after_reservation_expired',
          providerResponse,
          approvedAt: null,
        },
      }),
    ];
    if (!preserveOrder) {
      updates.push(this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      }));
    }
    await this.prisma.$transaction(updates);
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

  private mapStripeStatus(status: Stripe.PaymentIntent.Status) {
    const statuses: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
      canceled: PaymentStatus.CANCELLED,
      processing: PaymentStatus.IN_PROCESS,
      requires_action: PaymentStatus.PENDING,
      requires_capture: PaymentStatus.IN_PROCESS,
      requires_confirmation: PaymentStatus.PENDING,
      requires_payment_method: PaymentStatus.REJECTED,
      succeeded: PaymentStatus.APPROVED,
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

  private async getOwnedCardOrder(
    orderToken: string,
    customerId: string,
    provider: PaymentProvider,
    allowFinalized = false,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { publicToken: orderToken, customerId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    this.assertShippingQuoteReady(order);
    if (order.paymentMethod !== PaymentMethod.CARD) {
      throw new BadRequestException('La orden no utiliza pago con tarjeta.');
    }
    if (!allowFinalized && order.paymentStatus === PaymentStatus.APPROVED) {
      throw new ConflictException('La orden ya esta pagada.');
    }
    if (
      !allowFinalized &&
      (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED)
    ) {
      throw new ConflictException('La reserva de la orden ya no esta activa.');
    }
    this.cardPayment(order, provider);
    return order;
  }

  private assertShippingQuoteReady(order: { shippingQuoteStatus: ShippingQuoteStatus }) {
    if (order.shippingQuoteStatus === ShippingQuoteStatus.PENDING) {
      throw new ConflictException(
        'Estamos calculando el envio. Podras pagar cuando la tienda confirme el importe.',
      );
    }
  }

  private cardPayment(order: CardOrder, provider: PaymentProvider) {
    const payment = order.payments.find(
      (entry) =>
        entry.provider === provider &&
        entry.method === PaymentMethod.CARD &&
        !this.isSupersededPaymentStatus(entry.status),
    );
    if (!payment) {
      throw new BadRequestException('La orden pertenece a otra pasarela de pago.');
    }
    return payment;
  }

  private isSupersededPaymentStatus(status: PaymentStatus) {
    const supersededStatuses = new Set<PaymentStatus>([
      PaymentStatus.CANCELLED,
      PaymentStatus.REFUNDED,
      PaymentStatus.CHARGED_BACK,
    ]);
    return supersededStatuses.has(status);
  }

  private stripeClient() {
    return new Stripe(this.requireConfig('STRIPE_SECRET_KEY'));
  }

  private providerError(detail: string) {
    try {
      const parsed = JSON.parse(detail) as {
        message?: string;
        cause?: Array<{ description?: string }>;
      };
      return (
        parsed.cause?.find((entry) => entry.description)?.description ??
        parsed.message ??
        'No fue posible procesar el pago.'
      ).slice(0, 300);
    } catch {
      return 'No fue posible procesar el pago.';
    }
  }

  private requireConfig(name: string) {
    const value = this.config.get<string>(name);
    if (!value) throw new ServiceUnavailableException(`Falta configurar ${name}.`);
    return value;
  }
}
