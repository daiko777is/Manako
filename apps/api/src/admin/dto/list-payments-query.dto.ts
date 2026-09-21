import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination';

export class ListPaymentsQueryDto extends CursorPageQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'succeeded', 'failed', 'refunded'] })
  @IsOptional()
  @IsEnum(['pending', 'succeeded', 'failed', 'refunded'])
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
}
