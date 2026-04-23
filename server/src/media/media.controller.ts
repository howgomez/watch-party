import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('parse')
  parseUrl(@Body('url') url: string) {
    return this.mediaService.parseUrl(url);
  }
}
