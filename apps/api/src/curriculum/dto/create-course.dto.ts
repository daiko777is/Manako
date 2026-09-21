import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ minLength: 5, maxLength: 140 })
  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Precio en centavos (0 = gratis)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_00)
  priceCents?: number;

  @ApiPropertyOptional({ default: 'USD', maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' })
  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  level?: 'beginner' | 'intermediate' | 'advanced';

  @ApiPropertyOptional({ description: 'slug de categoría existente' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  thumbnailUrl?: string;
}
