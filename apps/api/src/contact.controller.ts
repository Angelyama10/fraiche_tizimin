import { Controller, Get, Query } from '@nestjs/common';
import { WhatsAppLinkQueryDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Get('whatsapp')
  whatsapp(@Query() query: WhatsAppLinkQueryDto) {
    return this.contact.whatsappLink(query);
  }
}
