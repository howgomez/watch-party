import { Injectable, BadRequestException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import ytSearch from 'yt-search';

export interface MediaDetails {
  type: MediaType;
  url: string;
  videoId?: string;
}

@Injectable()
export class MediaService {
  // Analiza una URL para detectar el tipo de medio y extraer IDs utiles
  parseUrl(url: string): MediaDetails {
    if (!url) {
      throw new BadRequestException('Se requiere proveer una URL');
    }

    // Deteccion de YouTube
    if (this.isYouTube(url)) {
      const videoId = this.extractYouTubeId(url);
      if (!videoId) {
        throw new BadRequestException('Formato de URL de YouTube inválida');
      }
      return { 
        type: 'YOUTUBE', 
        url, 
        videoId 
      };
    }

    // Deteccion de Vimeo (basica)
    if (url.includes('vimeo.com')) {
      return { 
        type: 'VIMEO', 
        url 
      };
    }

    // Cualquier otro formato de medio (MP4 en linea, M3U8, etc.)
    return { 
      type: 'CUSTOM', 
      url 
    };
  }

  // Busca videos en YouTube usando yt-search (scraping ligero, sin API Key)
  async searchYouTube(query: string) {
    if (!query) return [];
    
    try {
      const r = await ytSearch(query);
      const videos = r.videos.slice(0, 5); // Retornamos los primeros 5 resultados
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

  private isYouTube(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  // Extrae el ID unico de 11 caracteres de un video de YouTube
  private extractYouTubeId(url: string): string | null {
    // Regex magico que matchea todos los formatos comunes de urls de YT
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    return (match && match[2].length === 11) ? match[2] : null;
  }
}
