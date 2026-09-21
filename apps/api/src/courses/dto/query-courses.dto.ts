import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination';

export class QueryCoursesDto extends CursorPageQueryDto {
  @ApiPropertyOptional({ description: 'Búsqueda full-text por título/subtítulo (pg_trgm)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'slug de categoría' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ enum: ['beginner', 'intermediate', 'advanced'] })
  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  level?: 'beginner' | 'intermediate' | 'advanced';

  @ApiPropertyOptional({ description: 'precio mínimo en centavos' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'precio máximo en centavos (0 = solo gratis)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ['popular', 'rating', 'newest', 'price_asc', 'price_desc'], default: 'popular' })
  @IsOptional()
  @IsEnum(['popular', 'rating', 'newest', 'price_asc', 'price_desc'])
  sort?: 'popular' | 'rating' | 'newest' | 'price_asc' | 'price_desc';
}
