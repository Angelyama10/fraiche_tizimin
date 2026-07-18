import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import { OutboxStatus, Prisma } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from './prisma.service';

type ClaimedEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private running = false;
  private transporter?: Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  @Interval(5000)
  async process() {
    if (this.running || !this.isConfigured()) return;
    this.running = true;

    try {
      const events = await this.claimEvents();
      for (const event of events) {
        try {
          await this.sendNotification(event);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.SENT, processedAt: new Date(), lastError: null },
          });
        } catch (error) {
          const exhausted = event.attempts >= 10;
          const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(event.attempts, 7));
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: exhausted ? OutboxStatus.FAILED : OutboxStatus.PENDING,
              availableAt: new Date(Date.now() + delaySeconds * 1000),
              lastError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
            },
          });
          this.logger.error(
            `Fallo la notificacion ${event.id}: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private claimEvents() {
    return this.prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM "OutboxEvent"
        WHERE status = 'PENDING'::"OutboxStatus"
          AND "availableAt" <= NOW()
          AND attempts < 10
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 20
      )
      UPDATE "OutboxEvent" AS event
      SET status = 'PROCESSING'::"OutboxStatus",
          attempts = event.attempts + 1,
          "updatedAt" = NOW()
      FROM candidates
      WHERE event.id = candidates.id
      RETURNING event.id, event.type, event."aggregateType", event."aggregateId",
                event.payload, event.attempts
    `);
  }

  private async sendNotification(event: ClaimedEvent) {
    const message = await this.buildMessage(event);
    await this.getTransporter().sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }

  private async buildMessage(event: ClaimedEvent) {
    if (event.type === 'SPECIAL_REQUEST_CREATED') {
      const request = await this.prisma.specialRequest.findUniqueOrThrow({
        where: { id: event.aggregateId },
      });
      return {
        to: this.adminRecipient(),
        subject: `Nuevo pedido especial: ${request.requestedAroma}`,
        text: [
          `Cliente: ${request.customerName}`,
          `Correo: ${request.customerEmail}`,
          `Telefono: ${request.customerPhone ?? 'No proporcionado'}`,
          `Aroma: ${request.requestedAroma}`,
          `Linea: ${request.preferredLine ?? 'Sin preferencia'}`,
          `Notas: ${request.notes ?? 'Sin notas'}`,
        ].join('\n'),
      };
    }

    if (event.type === 'ORDER_CREATED' || event.type === 'PAYMENT_APPROVED') {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: event.aggregateId },
      });
      return {
        to:
          event.type === 'PAYMENT_APPROVED'
            ? [this.adminRecipient(), order.customerEmail]
            : this.adminRecipient(),
        subject:
          event.type === 'PAYMENT_APPROVED'
            ? `Pago aprobado: ${order.number}`
            : `Nueva orden: ${order.number}`,
        text: [
          `Orden: ${order.number}`,
          `Cliente: ${order.customerName}`,
          `Telefono: ${order.customerPhone}`,
          `Total: $${(order.totalCents / 100).toFixed(2)} ${order.currency}`,
          `Estado: ${order.status}`,
          `Pago: ${order.paymentStatus}`,
        ].join('\n'),
      };
    }

    if (event.type === 'TRANSFER_PROOF_RECEIVED') {
      const payment = await this.prisma.payment.findUniqueOrThrow({
        where: { id: event.aggregateId },
        include: { order: true },
      });
      return {
        to: this.adminRecipient(),
        subject: `Comprobante recibido: ${payment.order.number}`,
        text: `Se recibio un comprobante para la orden ${payment.order.number}. Requiere revision administrativa.`,
      };
    }

    if (event.type === 'CUSTOMER_PASSWORD_RESET_REQUESTED') {
      const request = await this.prisma.passwordResetRequest.findUniqueOrThrow({
        where: { id: event.aggregateId },
        include: { customer: true },
      });
      if (!request.customer.email || request.usedAt || request.expiresAt <= new Date()) {
        throw new Error('La solicitud de recuperacion ya no esta vigente.');
      }
      const expiresIn = Math.max(
        60,
        Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
      );
      const token = await this.jwt.signAsync(
        {
          sub: request.customerId,
          requestId: request.id,
          tokenType: 'PASSWORD_RESET',
        },
        {
          audience: 'fraiche-password-reset',
          issuer: 'fraiche-api',
          expiresIn,
        },
      );
      const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL').replace(/\/$/, '');
      return {
        to: request.customer.email,
        subject: 'Recupera tu cuenta de Fraiche Tizimin',
        text: [
          `Hola ${request.customer.firstName ?? ''},`,
          'Recibimos una solicitud para cambiar tu contrasena.',
          `${webAppUrl}/recuperar-contrasena?token=${encodeURIComponent(token)}`,
          'El enlace vence en 30 minutos y solo puede utilizarse una vez.',
          'Si no hiciste esta solicitud, puedes ignorar este correo.',
        ].join('\n\n'),
      };
    }

    if (event.type === 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED') {
      const customer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: event.aggregateId },
      });
      if (!customer.email || customer.emailVerifiedAt) {
        throw new Error('La cuenta ya esta verificada o no tiene correo.');
      }
      const token = await this.jwt.signAsync(
        {
          sub: customer.id,
          email: customer.email,
          tokenType: 'EMAIL_VERIFICATION',
        },
        {
          audience: 'fraiche-email-verification',
          issuer: 'fraiche-api',
          expiresIn: '24h',
        },
      );
      const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL').replace(/\/$/, '');
      return {
        to: customer.email,
        subject: 'Verifica tu correo de Fraiche Tizimin',
        text: [
          `Hola ${customer.firstName ?? ''},`,
          'Confirma tu correo para proteger tus compras y recibir avisos de entrega.',
          `${webAppUrl}/verificar-correo?token=${encodeURIComponent(token)}`,
          'El enlace vence en 24 horas.',
        ].join('\n\n'),
      };
    }

    if (event.type === 'LOW_STOCK_ALERT') {
      const alert = await this.prisma.inventoryAlert.findUniqueOrThrow({
        where: { id: event.aggregateId },
        include: {
          inventoryLevel: {
            include: { location: true, variant: { include: { product: true } } },
          },
        },
      });
      const level = alert.inventoryLevel;
      return {
        to: this.adminRecipient(),
        subject: `Inventario bajo: ${level.variant.product.name}`,
        text: [
          `Producto: ${level.variant.product.name}`,
          `Variante: ${level.variant.name} (${level.variant.sku})`,
          `Ubicacion: ${level.location.name}`,
          `Disponibles: ${level.available}`,
          `Umbral configurado: ${level.lowStockThreshold}`,
        ].join('\n'),
      };
    }

    if (event.type === 'SHIPMENT_UPDATED') {
      const payload =
        event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? event.payload
          : {};
      const shipmentId = 'shipmentId' in payload ? String(payload.shipmentId) : undefined;
      const [order, shipment] = await Promise.all([
        this.prisma.order.findUniqueOrThrow({ where: { id: event.aggregateId } }),
        shipmentId
          ? this.prisma.shipment.findUnique({ where: { id: shipmentId } })
          : Promise.resolve(null),
      ]);
      return {
        to: order.customerEmail,
        subject: `Actualizacion de envio: ${order.number}`,
        text: [
          `Tu pedido ${order.number} cambio a ${shipment?.status ?? order.fulfillmentStatus}.`,
          shipment ? `Paqueteria: ${shipment.carrier}` : '',
          shipment ? `Guia: ${shipment.trackingNumber}` : '',
          shipment?.trackingUrl ? `Rastreo: ${shipment.trackingUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    if (event.type === 'ORDER_STATUS_UPDATED') {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: event.aggregateId },
      });
      return {
        to: order.customerEmail,
        subject: `Tu pedido ${order.number}: ${order.status}`,
        text: `El estado de tu pedido ${order.number} ahora es ${order.status}. Puedes ver el detalle desde tu cuenta.`,
      };
    }

    return {
      to: this.adminRecipient(),
      subject: `Evento Fraiche: ${event.type}`,
      text: `Tipo: ${event.type}\nEntidad: ${event.aggregateType}\nID: ${event.aggregateId}`,
    };
  }

  private getTransporter() {
    if (!this.transporter) {
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASS');
      this.transporter = nodemailer.createTransport({
        host: this.config.getOrThrow<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: Number(this.config.get<string>('SMTP_PORT') ?? 587) === 465,
        ...(user && pass ? { auth: { user, pass } } : {}),
      });
    }
    return this.transporter;
  }

  private isConfigured() {
    return Boolean(
      this.config.get<string>('SMTP_HOST') &&
        this.config.get<string>('SMTP_FROM'),
    );
  }

  private adminRecipient() {
    return this.config.getOrThrow<string>('ADMIN_NOTIFICATION_EMAIL');
  }
}
