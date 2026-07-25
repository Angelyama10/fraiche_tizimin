import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MediaAssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage.service';
import { DEFAULT_SITE_CONTENT } from './site-content.defaults';
import type { CompleteMediaAssetDto, PresignMediaAssetDto } from './content.dto';
import type { SiteContentDocument } from './site-content.types';
import { validateSiteContent } from './site-content.validation';

const SITE_CONTENT_KEY = 'main';

@Injectable()
export class SiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
  ) {}

  async getPublished() {
    const site = await this.ensureSiteContent();
    return {
      content: validateSiteContent(site.publishedContent),
      version: site.version,
      publishedAt: site.publishedAt,
    };
  }

  async getPreview(token: string) {
    let payload: { scope?: string; key?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        audience: 'fraiche-preview',
        issuer: 'fraiche-api',
      });
    } catch {
      throw new NotFoundException('La vista previa expiró o no es válida.');
    }
    if (payload.scope !== 'site-content-preview' || payload.key !== SITE_CONTENT_KEY) {
      throw new NotFoundException('La vista previa no es válida.');
    }
    const site = await this.ensureSiteContent();
    return {
      content: validateSiteContent(site.draftContent),
      version: site.version,
      preview: true,
    };
  }

  async getAdminContent() {
    const site = await this.ensureSiteContent();
    const revisions = await this.prisma.siteContentRevision.findMany({
      where: { siteContentId: site.id },
      orderBy: { version: 'desc' },
      take: 15,
      select: {
        id: true,
        version: true,
        createdAt: true,
        publishedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return {
      id: site.id,
      draftContent: validateSiteContent(site.draftContent),
      publishedContent: validateSiteContent(site.publishedContent),
      version: site.version,
      publishedAt: site.publishedAt,
      updatedAt: site.updatedAt,
      revisions,
    };
  }

  async saveDraft(input: unknown, actorId: string) {
    const content = validateSiteContent(input);
    const site = await this.ensureSiteContent();
    const updated = await this.prisma.siteContent.update({
      where: { id: site.id },
      data: {
        draftContent: content as unknown as Prisma.InputJsonValue,
        updatedById: actorId,
      },
      select: { id: true, version: true, updatedAt: true },
    });
    return { ...updated, draftContent: content };
  }

  async publish(actorId: string) {
    const site = await this.ensureSiteContent();
    const content = validateSiteContent(site.draftContent);
    const nextVersion = site.version + 1;

    const published = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.siteContent.updateMany({
        where: { id: site.id, version: site.version },
        data: {
          publishedContent: content as unknown as Prisma.InputJsonValue,
          version: nextVersion,
          publishedAt: new Date(),
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('El contenido cambió en otra sesión. Recarga el editor antes de publicar.');
      }
      await tx.siteContentRevision.create({
        data: {
          siteContentId: site.id,
          version: nextVersion,
          content: content as unknown as Prisma.InputJsonValue,
          publishedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SITE_CONTENT_PUBLISHED',
          entityType: 'SiteContent',
          entityId: site.id,
          after: { version: nextVersion },
        },
      });
      return tx.siteContent.findUniqueOrThrow({ where: { id: site.id } });
    });

    return {
      version: published.version,
      publishedAt: published.publishedAt,
      content,
    };
  }

  async createPreviewToken(actorId: string) {
    const token = await this.jwt.signAsync(
      { scope: 'site-content-preview', key: SITE_CONTENT_KEY, actorId },
      { audience: 'fraiche-preview', expiresIn: '15m' },
    );
    return { token, expiresInSeconds: 900 };
  }

  async listMedia(page = 1, pageSize = 40) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where: { status: MediaAssetStatus.READY },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mediaAsset.count({ where: { status: MediaAssetStatus.READY } }),
    ]);
    return { items, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async presignMedia(input: PresignMediaAssetDto, actorId: string) {
    const upload = await this.storage.presignSiteImage(input);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        objectKey: upload.objectKey,
        fileName: input.fileName,
        url: upload.fileUrl,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
        altText: input.altText?.trim() || null,
        createdById: actorId,
      },
    });
    return { asset, ...upload };
  }

  async completeMedia(id: string, input: CompleteMediaAssetDto, actorId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.status === MediaAssetStatus.ARCHIVED) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        status: MediaAssetStatus.READY,
        width: input.width,
        height: input.height,
        altText: input.altText?.trim() || asset.altText,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'MEDIA_ASSET_CREATED',
        entityType: 'MediaAsset',
        entityId: updated.id,
        after: { url: updated.url, mimeType: updated.mimeType, sizeBytes: updated.sizeBytes },
      },
    });
    return updated;
  }

  async archiveMedia(id: string, actorId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Imagen no encontrada.');
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status: MediaAssetStatus.ARCHIVED },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'MEDIA_ASSET_ARCHIVED',
        entityType: 'MediaAsset',
        entityId: updated.id,
      },
    });
    return { archived: true };
  }

  private async ensureSiteContent() {
    const defaults = DEFAULT_SITE_CONTENT as unknown as Prisma.InputJsonValue;
    return this.prisma.siteContent.upsert({
      where: { key: SITE_CONTENT_KEY },
      update: {},
      create: {
        key: SITE_CONTENT_KEY,
        draftContent: defaults,
        publishedContent: defaults,
        publishedAt: new Date(),
      },
    });
  }
}
