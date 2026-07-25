import { Injectable, NotFoundException } from '@nestjs/common';
import { ListAdminNotificationsDto } from './admin-commerce.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListAdminNotificationsDto) {
    const where = {
      userId,
      readAt: query.unreadOnly ? null : undefined,
    };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        where,
        include: {
          order: {
            select: {
              publicToken: true,
              number: true,
              customerName: true,
              totalCents: true,
              currency: true,
              paymentStatus: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      data,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
      unreadCount,
      generatedAt: new Date(),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.adminNotification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Notificacion no encontrada.');
    return { read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.adminNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
