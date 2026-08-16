import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PresignTransferProofDto } from './payment.dto';
import { PrismaService } from './prisma.service';
import { isShippingQuoteReadyForPayment } from './shipping-quote';

@Injectable()
export class StorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async presignTransferProof(input: PresignTransferProofDto, customerId: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicToken: input.orderToken, customerId },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        deliveryMethod: true,
        shippingQuoteStatus: true,
        expiresAt: true,
      },
    });
    if (!order || order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new NotFoundException('Orden de transferencia no encontrada.');
    }
    if (!isShippingQuoteReadyForPayment(order.deliveryMethod, order.shippingQuoteStatus)) {
      throw new ConflictException(
        'La tienda debe confirmar el costo de entrega antes de recibir el comprobante.',
      );
    }
    if (
      order.status !== OrderStatus.PENDING_PAYMENT ||
      order.paymentStatus === PaymentStatus.APPROVED ||
      (order.expiresAt && order.expiresAt <= new Date())
    ) {
      throw new ConflictException('La reserva de la orden ya no esta activa.');
    }

    const bucket = this.requireConfig('STORAGE_PRIVATE_BUCKET');
    const privateUrl = this.requireConfig('STORAGE_PRIVATE_URL').replace(/\/$/, '');
    const client = this.createClient();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
    const objectKey = `transfer-proofs/${order.id}/${randomUUID()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      Metadata: { orderId: order.id },
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return {
      uploadUrl,
      objectKey,
      fileUrl: `${privateUrl}/${objectKey}`,
      expiresInSeconds: 600,
      requiredHeaders: { 'content-type': input.contentType },
    };
  }

  async presignTransferProofDownload(proofId: string) {
    const proof = await this.prisma.transferProof.findUnique({
      where: { id: proofId },
      select: { objectKey: true, fileName: true, mimeType: true },
    });
    if (!proof) throw new NotFoundException('Comprobante no encontrado.');

    const safeName = proof.fileName.replace(/["\r\n]/g, '-');
    const command = new GetObjectCommand({
      Bucket: this.requireConfig('STORAGE_PRIVATE_BUCKET'),
      Key: proof.objectKey,
      ResponseContentDisposition: `inline; filename="${safeName}"`,
      ResponseContentType: proof.mimeType,
    });
    const url = await getSignedUrl(this.createClient(), command, { expiresIn: 300 });

    return { url, expiresInSeconds: 300 };
  }

  async presignSiteImage(input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }) {
    const bucket = this.requireConfig('STORAGE_PUBLIC_BUCKET');
    const publicUrl = this.requireConfig('STORAGE_PUBLIC_URL').replace(/\/$/, '');
    const client = this.createClient();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
    const date = new Date().toISOString().slice(0, 10);
    const objectKey = `site-content/${date}/${randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    return {
      uploadUrl,
      objectKey,
      fileUrl: `${publicUrl}/${objectKey}`,
      expiresInSeconds: 600,
      requiredHeaders: { 'content-type': input.contentType },
    };
  }

  private createClient() {
    const accessKeyId = this.requireConfig('STORAGE_ACCESS_KEY');
    const secretAccessKey = this.requireConfig('STORAGE_SECRET_KEY');
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT') || undefined;

    return new S3Client({
      region: this.config.get<string>('STORAGE_REGION') || 'auto',
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private requireConfig(name: string) {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new ServiceUnavailableException(`Falta configurar ${name}.`);
    }
    return value;
  }
}
