import { IsString, IsUrl, IsEnum, MinLength, MaxLength } from 'class-validator';
import { MediaType } from '@prisma/client';

export class CreateRoomDto {
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    title: string;

    @IsUrl()
    media_url: string;

    @IsEnum(MediaType)
    media_type: MediaType;
}