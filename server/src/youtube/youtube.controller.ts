import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import ytSearch from 'yt-search';

@Controller('youtube')
export class YoutubeController {
  
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(@Query('q') query: string) {
    if (!query) return [];
    
    try {
      const r = await ytSearch(query);
      const videos = r.videos.slice(0, 5);
      return videos.map(v => ({
        id: v.videoId,
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name,
      }));
    } catch (error) {
      throw new BadRequestException('No se pudieron obtener resultados de YouTube');
    }
  }
}
