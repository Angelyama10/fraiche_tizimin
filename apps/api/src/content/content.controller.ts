import { Controller, Get, Header, Param } from '@nestjs/common';
import { SiteContentService } from './site-content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: SiteContentService) {}

  @Get('site')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300')
  getSite() {
    return this.content.getPublished();
  }

  @Get('preview/:token')
  @Header('Cache-Control', 'private, no-store')
  getPreview(@Param('token') token: string) {
    return this.content.getPreview(token);
  }
}
