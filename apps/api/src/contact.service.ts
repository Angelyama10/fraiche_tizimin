import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartsService } from './carts.service';
import { WhatsAppLinkQueryDto } from './contact.dto';
import { OrdersService } from './orders.service';
import { SiteContentService } from './content/site-content.service';

@Injectable()
export class ContactService {
  constructor(
    private readonly config: ConfigService,
    private readonly carts: CartsService,
    private readonly orders: OrdersService,
    private readonly siteContent: SiteContentService,
  ) {}

  async whatsappLink(query: WhatsAppLinkQueryDto) {
    if (query.cartToken && query.orderToken) {
      throw new BadRequestException('Usa un carrito o una orden, no ambos.');
    }

    const lines = ['Hola, Fraiche Tizimin.'];
    if (query.message?.trim()) lines.push(query.message.trim());

    if (query.cartToken) {
      const cart = await this.carts.get(query.cartToken);
      lines.push('', 'Me interesa este carrito:');
      for (const item of cart.items) {
        lines.push(
          `- ${item.quantity} x ${item.product.name} (${item.variant.name}) $${(
            item.lineTotalCents / 100
          ).toFixed(2)} MXN`,
        );
      }
      lines.push(`Total: $${(cart.subtotalCents / 100).toFixed(2)} MXN`);
    }

    if (query.orderToken) {
      const order = await this.orders.get(query.orderToken);
      lines.push(
        '',
        `Quiero consultar la orden ${order.number}.`,
        `Estado: ${order.status}.`,
        `Total: $${(order.totalCents / 100).toFixed(2)} MXN.`,
      );
    }

    if (!query.cartToken && !query.orderToken && !query.message?.trim()) {
      lines.push('Quiero informacion sobre sus perfumes.');
    }

    const published = await this.siteContent.getPublished().catch(() => null);
    const configuredPhone = published?.content.global.contact.whatsappPhone
      ?? this.config.get<string>('WHATSAPP_PHONE')
      ?? '';
    const phone = configuredPhone.replace(/\D/g, '');
    if (!phone) throw new ServiceUnavailableException('Falta configurar WHATSAPP_PHONE.');

    const message = lines.join('\n');
    return { url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`, message };
  }
}
