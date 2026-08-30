import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import {
  DeliveryMethod,
  OrderStatus,
  OutboxStatus,
  Prisma,
  ShipmentStatus,
  ShippingQuoteStatus,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from './prisma.service';

type ClaimedEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const SMTP_DAILY_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SMTP_AUTHENTICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SUPPRESSED_EMAIL_REASON =
  'Correo suprimido por la politica de notificaciones: no corresponde al flujo de pedidos.';

export const EMAIL_NOTIFICATION_TYPES = [
  'SPECIAL_REQUEST_CREATED',
  'ORDER_CREATED',
  'ORDER_RECEIVED',
  'SHIPPING_QUOTE_READY',
  'TRANSFER_PROOF_RECEIVED',
  'PAYMENT_APPROVED',
  'ORDER_PAYMENT_CONFIRMED',
  'ORDER_STATUS_UPDATED',
  'SHIPMENT_UPDATED',
  'CUSTOMER_PASSWORD_RESET_REQUESTED',
  'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
] as const;

const emailNotificationTypes = new Set<string>(EMAIL_NOTIFICATION_TYPES);

export function isEmailNotificationType(type: string) {
  return emailNotificationTypes.has(type);
}

export function isSmtpAuthenticationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /535(?:-| )5\.7\.8/i.test(message) ||
    /invalid login/i.test(message) ||
    /username and password not accepted/i.test(message)
  );
}

@Injectable()
export class OutboxService implements OnModuleInit {
  private readonly logger = new Logger(OutboxService.name);
  private running = false;
  private transporter?: Transporter;
  private configurationWarningLogged = false;
  private smtpPausedUntil?: Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    if (!this.isConfigured()) {
      this.logConfigurationWarning();
      return;
    }

    try {
      await this.getTransporter().verify();
      this.logger.log('Conexion SMTP verificada correctamente.');
    } catch (error) {
      this.logger.error(
        `No se pudo verificar SMTP al iniciar: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  @Interval(5000)
  async process() {
    if (this.running) return;
    await this.suppressNonEmailEvents();
    if (this.isSmtpPaused()) return;
    if (!this.isConfigured()) {
      this.logConfigurationWarning();
      return;
    }
    this.running = true;

    try {
      const events = await this.claimEvents();
      for (const event of events) {
        if (this.isSmtpPaused()) {
          await this.deferClaimedEvent(event);
          continue;
        }

        try {
          await this.sendNotification(event);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.SENT, processedAt: new Date(), lastError: null },
          });
        } catch (error) {
          const dailyLimitReached = this.isDailySendingLimitError(error);
          const authenticationRejected = isSmtpAuthenticationError(error);
          if (dailyLimitReached || authenticationRejected) {
            const cooldownMs = dailyLimitReached
              ? SMTP_DAILY_LIMIT_COOLDOWN_MS
              : SMTP_AUTHENTICATION_COOLDOWN_MS;
            const availableAt = new Date(Date.now() + cooldownMs);
            this.smtpPausedUntil = availableAt;
            await this.prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: OutboxStatus.PENDING,
                attempts: { decrement: 1 },
                availableAt,
                lastError: this.errorMessage(error),
              },
            });
            this.logger.warn(
              dailyLimitReached
                ? `Gmail alcanzo su limite diario. Notificaciones pausadas hasta ${availableAt.toISOString()}.`
                : `Gmail rechazo la autenticacion. Notificaciones conservadas y pausadas hasta ${availableAt.toISOString()}.`,
            );
            continue;
          }

          const exhausted = event.attempts >= 10;
          const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(event.attempts, 7));
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: exhausted ? OutboxStatus.FAILED : OutboxStatus.PENDING,
              availableAt: new Date(Date.now() + delaySeconds * 1000),
              lastError: this.errorMessage(error),
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

  private async suppressNonEmailEvents() {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxStatus.PENDING,
        type: { notIn: [...EMAIL_NOTIFICATION_TYPES] },
      },
      data: {
        status: OutboxStatus.FAILED,
        processedAt: new Date(),
        lastError: SUPPRESSED_EMAIL_REASON,
      },
    });
    if (result.count) {
      this.logger.log(
        `${result.count} evento(s) internos fueron suprimidos y no se enviaron por correo.`,
      );
    }
  }

  private isSmtpPaused() {
    if (!this.smtpPausedUntil) return false;
    if (this.smtpPausedUntil.getTime() > Date.now()) return true;
    this.smtpPausedUntil = undefined;
    return false;
  }

  private async deferClaimedEvent(event: ClaimedEvent) {
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: OutboxStatus.PENDING,
        attempts: { decrement: 1 },
        availableAt: this.smtpPausedUntil ?? new Date(),
      },
    });
  }

  private isDailySendingLimitError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      /550(?:-| )5\.4\.5/i.test(message) ||
      /daily (?:user )?sending limit exceeded/i.test(message)
    );
  }

  private errorMessage(error: unknown) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
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
      from: this.smtpValue('SMTP_FROM'),
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

    if (
      event.type === 'ORDER_CREATED' ||
      event.type === 'ORDER_RECEIVED' ||
      event.type === 'PAYMENT_APPROVED' ||
      event.type === 'ORDER_PAYMENT_CONFIRMED' ||
      event.type === 'SHIPPING_QUOTE_READY'
    ) {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: event.aggregateId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });

      if (event.type === 'ORDER_CREATED') {
        return {
          to: this.adminRecipient(),
          subject: `Nuevo pedido: ${order.number}`,
          text: this.adminOrderSummary(order),
        };
      }

      if (event.type === 'ORDER_RECEIVED') {
        const pendingQuote = order.shippingQuoteStatus === ShippingQuoteStatus.PENDING;
        return {
          to: order.customerEmail,
          subject: pendingQuote
            ? `Recibimos tu pedido ${order.number}: envio en cotizacion`
            : `Recibimos tu pedido ${order.number}`,
          text: [
            `Hola ${order.customerName},`,
            `Recibimos tu pedido ${order.number}.`,
            pendingQuote
              ? 'Tu pedido esta en espera mientras calculamos el costo de envio. Te avisaremos por correo cuando la cotizacion este lista para que puedas pagar.'
              : 'Tu pedido fue reservado y ya puedes continuar con el pago.',
            `Subtotal: ${this.money(order.subtotalCents, order.currency)}`,
            `Consulta tu pedido: ${this.webAppUrl()}/pedidos/${order.publicToken}`,
          ].join('\n\n'),
        };
      }

      if (event.type === 'SHIPPING_QUOTE_READY') {
        return {
          to: order.customerEmail,
          subject: `Tu cotizacion de envio esta lista: ${order.number}`,
          text: [
            `Hola ${order.customerName},`,
            `Ya asignamos el envio de tu pedido ${order.number}.`,
            `Envio: ${this.money(order.shippingCents, order.currency)}`,
            `Total a pagar: ${this.money(order.totalCents, order.currency)}`,
            order.shippingQuoteNotes ? `Nota de entrega: ${order.shippingQuoteNotes}` : '',
            `Continua con el pago: ${this.webAppUrl()}/pago/${order.publicToken}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        };
      }

      if (event.type === 'PAYMENT_APPROVED') {
        return {
          to: this.adminRecipient(),
          subject: `Pago aprobado: ${order.number}`,
          text: [
            `El pago del pedido ${order.number} fue aprobado.`,
            this.adminOrderSummary(order),
          ].join('\n\n'),
        };
      }

      return {
        to: order.customerEmail,
        subject: `Pago confirmado: ${order.number}`,
        text: [
          `Hola ${order.customerName},`,
          `Confirmamos el pago de tu pedido ${order.number}.`,
          `Total pagado: ${this.money(order.totalCents, order.currency)}`,
          'Ahora prepararemos tus productos. Te avisaremos cuando cambie el estado o el envio.',
          `Consulta tu pedido: ${this.webAppUrl()}/pedidos/${order.publicToken}`,
        ].join('\n\n'),
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
        subject: `${this.shipmentStatusLabel(shipment?.status)}: ${order.number}`,
        text: [
          `Tu pedido ${order.number}: ${this.shipmentStatusLabel(shipment?.status)}.`,
          shipment ? `Paqueteria: ${shipment.carrier}` : '',
          shipment ? `Guia: ${shipment.trackingNumber}` : '',
          shipment?.trackingUrl ? `Rastreo: ${shipment.trackingUrl}` : '',
          `Consulta tu pedido: ${this.webAppUrl()}/pedidos/${order.publicToken}`,
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
        subject: `${this.orderStatusLabel(order.status, order.deliveryMethod)}: ${order.number}`,
        text: [
          `Hola ${order.customerName},`,
          `Tu pedido ${order.number}: ${this.orderStatusLabel(order.status, order.deliveryMethod)}.`,
          this.orderStatusExplanation(order.status, order.deliveryMethod),
          `Consulta tu pedido: ${this.webAppUrl()}/pedidos/${order.publicToken}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    }

    throw new Error(`El evento ${event.type} no esta autorizado para envio por correo.`);
  }

  private adminOrderSummary(order: {
    number: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    deliveryMethod: DeliveryMethod;
    shippingAddress: Prisma.JsonValue | null;
    subtotalCents: number;
    shippingCents: number;
    discountCents: number;
    totalCents: number;
    currency: string;
    customerNotes: string | null;
    items: Array<{
      productName: string;
      productLine: string;
      variantName: string;
      sku: string;
      concentrationLabel: string | null;
      concentrationPercent: Prisma.Decimal | null;
      volumeMl: number | null;
      quantity: number;
    }>;
  }) {
    const products = order.items.map((item, index) =>
      [
        `${index + 1}. ${item.productName}`,
        `Cantidad: ${item.quantity}`,
        `Presentacion: ${item.variantName}`,
        `SKU: ${item.sku}`,
        `Linea: ${item.productLine}`,
        item.concentrationLabel ? `Concentracion: ${item.concentrationLabel}` : '',
        item.concentrationPercent
          ? `Porcentaje: ${item.concentrationPercent.toString()}%`
          : '',
        item.volumeMl ? `Volumen: ${item.volumeMl} ml` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return [
      `Orden: ${order.number}`,
      `Cliente: ${order.customerName}`,
      `Correo: ${order.customerEmail}`,
      `Telefono: ${order.customerPhone}`,
      `Entrega: ${this.deliveryMethodLabel(order.deliveryMethod)}`,
      this.shippingAddressLine(order.shippingAddress),
      '',
      'Productos:',
      products.join('\n\n'),
      '',
      `Subtotal: ${this.money(order.subtotalCents, order.currency)}`,
      `Descuento: ${this.money(order.discountCents, order.currency)}`,
      `Envio: ${this.money(order.shippingCents, order.currency)}`,
      `Total: ${this.money(order.totalCents, order.currency)}`,
      order.customerNotes ? `Notas del cliente: ${order.customerNotes}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private money(cents: number, currency: string) {
    return (cents / 100).toLocaleString('es-MX', { style: 'currency', currency });
  }

  private webAppUrl() {
    return this.config.getOrThrow<string>('WEB_APP_URL').replace(/\/$/, '');
  }

  private deliveryMethodLabel(method: DeliveryMethod) {
    return method === DeliveryMethod.STORE_PICKUP
      ? 'Recoger en tienda'
      : method === DeliveryMethod.LOCAL_DELIVERY
        ? 'Entrega local'
        : 'Envio nacional';
  }

  private shippingAddressLine(address: Prisma.JsonValue | null) {
    if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
    const value = address as Record<string, Prisma.JsonValue>;
    const parts = [
      value.street,
      value.exteriorNumber,
      value.interiorNumber ? `Int. ${value.interiorNumber}` : null,
      value.neighborhood,
      value.city,
      value.municipality,
      value.state,
      value.postalCode,
    ].filter((part): part is string | number =>
      typeof part === 'string' || typeof part === 'number',
    );
    return parts.length ? `Direccion: ${parts.join(', ')}` : '';
  }

  private orderStatusLabel(status: OrderStatus, deliveryMethod: DeliveryMethod) {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.PENDING_PAYMENT]: 'Pedido en espera de pago',
      [OrderStatus.CONFIRMED]: 'Pedido confirmado',
      [OrderStatus.PROCESSING]: 'Estamos preparando tu pedido',
      [OrderStatus.READY]:
        deliveryMethod === DeliveryMethod.STORE_PICKUP
          ? 'Tu pedido esta listo para recoger'
          : 'Tu pedido esta listo para enviar',
      [OrderStatus.COMPLETED]: 'Pedido completado',
      [OrderStatus.CANCELLED]: 'Pedido cancelado',
      [OrderStatus.EXPIRED]: 'Pedido vencido',
    };
    return labels[status];
  }

  private orderStatusExplanation(status: OrderStatus, deliveryMethod: DeliveryMethod) {
    if (status === OrderStatus.PENDING_PAYMENT) return 'Aun necesitamos confirmar el pago.';
    if (status === OrderStatus.CONFIRMED) return 'Tu pago fue confirmado.';
    if (status === OrderStatus.PROCESSING) return 'Estamos preparando tus productos.';
    if (status === OrderStatus.READY) {
      return deliveryMethod === DeliveryMethod.STORE_PICKUP
        ? 'Ya puedes pasar a la tienda por tu pedido.'
        : 'El paquete esta listo para entregarse a la paqueteria.';
    }
    if (status === OrderStatus.COMPLETED) return 'El pedido fue entregado o concluido.';
    if (status === OrderStatus.CANCELLED) return 'Este pedido ya no continuara su proceso.';
    if (status === OrderStatus.EXPIRED) {
      return 'La reserva vencio antes de confirmar el pago. Puedes crear un pedido nuevo.';
    }
    return '';
  }

  private shipmentStatusLabel(status?: ShipmentStatus) {
    if (!status) return 'Actualizacion de envio';
    const labels: Record<ShipmentStatus, string> = {
      [ShipmentStatus.PENDING]: 'Envio pendiente',
      [ShipmentStatus.LABEL_CREATED]: 'Guia de envio creada',
      [ShipmentStatus.IN_TRANSIT]: 'Pedido enviado',
      [ShipmentStatus.OUT_FOR_DELIVERY]: 'Pedido en reparto',
      [ShipmentStatus.DELIVERED]: 'Pedido entregado',
      [ShipmentStatus.EXCEPTION]: 'Incidencia en el envio',
      [ShipmentStatus.RETURNED]: 'Pedido devuelto',
      [ShipmentStatus.CANCELLED]: 'Envio cancelado',
    };
    return labels[status];
  }

  private getTransporter() {
    if (!this.transporter) {
      const user = this.smtpValue('SMTP_USER');
      const pass = this.smtpPassword();
      const port = Number(this.smtpValue('SMTP_PORT') || 587);
      this.transporter = nodemailer.createTransport({
        host: this.smtpValue('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
    return this.transporter;
  }

  private isConfigured() {
    return (
      ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER'].every((key) =>
        Boolean(this.smtpValue(key)),
      ) && Boolean(this.smtpPassword())
    );
  }

  private smtpValue(key: string) {
    return this.config.get<string>(key)?.trim() ?? '';
  }

  private smtpPassword() {
    const password = this.smtpValue('SMTP_PASS');
    return this.smtpValue('SMTP_HOST').toLowerCase().includes('gmail.com')
      ? password.replace(/\s+/g, '')
      : password;
  }

  private logConfigurationWarning() {
    if (this.configurationWarningLogged) return;
    this.configurationWarningLogged = true;
    const missing = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER'].filter(
      (key) => !this.smtpValue(key),
    );
    if (!this.smtpPassword()) missing.push('SMTP_PASS');
    this.logger.warn(
      `Notificaciones por correo pausadas. Faltan variables SMTP: ${missing.join(', ')}.`,
    );
  }

  private adminRecipient() {
    return this.config.getOrThrow<string>('ADMIN_NOTIFICATION_EMAIL');
  }
}
