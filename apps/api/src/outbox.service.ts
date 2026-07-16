import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      to: this.config.getOrThrow<string>('ADMIN_NOTIFICATION_EMAIL'),
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
        subject: `Comprobante recibido: ${payment.order.number}`,
        text: `Se recibio un comprobante para la orden ${payment.order.number}. Requiere revision administrativa.`,
      };
    }

    return {
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
        this.config.get<string>('SMTP_FROM') &&
        this.config.get<string>('ADMIN_NOTIFICATION_EMAIL'),
    );
  }
}
