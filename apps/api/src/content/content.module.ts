import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { UploadsModule } from '../uploads.module';
import { ContentController } from './content.controller';
import { SiteContentService } from './site-content.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [ContentController],
  providers: [SiteContentService],
  exports: [SiteContentService],
})
export class ContentModule {}
