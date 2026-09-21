import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Paginación cursor-based obligatoria en todos los listados (spec §7.3).
 * El cursor es el `id` del último elemento de la página anterior.
 */
export class CursorPageQueryDto {
  @ApiPropertyOptional({ description: 'id del último elemento de la página anterior' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}

/** Convierte el resultado de findMany(take: limit+1, cursor) en PaginatedResult. */
export function paginate<T extends { id: string }>(rows: T[], limit: number): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore && data.length > 0 ? data[data.length - 1]!.id : null };
}
