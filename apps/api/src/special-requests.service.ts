import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSpecialRequestDto } from './special-request.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class SpecialRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSpecialRequestDto) {
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.specialRequest.create({
        data: {
          customerName: input.customerName.trim(),
          customerEmail: input.customerEmail.trim().toLowerCase(),
          customerPhone: input.customerPhone?.trim(),
          requestedAroma: input.requestedAroma.trim(),
          preferredLine: input.preferredLine,
          notes: input.notes?.trim(),
        },
      });
      await transaction.outboxEvent.create({
        data: {
          type: 'SPECIAL_REQUEST_CREATED',
          aggregateType: 'SpecialRequest',
          aggregateId: request.id,
          payload: {
            requestId: request.id,
            publicToken: request.publicToken,
            requestedAroma: request.requestedAroma,
          },
        },
      });
      return {
        publicToken: request.publicToken,
        status: request.status,
        createdAt: request.createdAt,
      };
    });
  }

  async get(publicToken: string) {
    const request = await this.prisma.specialRequest.findUnique({
      where: { publicToken },
      select: {
        publicToken: true,
        requestedAroma: true,
        preferredLine: true,
        status: true,
        quotedCents: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!request) throw new NotFoundException('Pedido especial no encontrado.');
    return request;
  }
}
