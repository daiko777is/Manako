import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ maxLength: 140 })
  @IsString()
  @MaxLength(140)
  title!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Duración en segundos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  durationSeconds?: number;

  @ApiPropertyOptional({ enum: ['mux', 'cloudflare', 'direct'], description: 'Default: VIDEO_PROVIDER del servidor' })
  @IsOptional()
  @IsEnum(['mux', 'cloudflare', 'direct'])
  videoProvider?: 'mux' | 'cloudflare' | 'direct';

  @ApiPropertyOptional({ description: 'Solo provider=direct (desarrollo): URL del mp4' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Lección de muestra visible sin inscripción', default: false })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
