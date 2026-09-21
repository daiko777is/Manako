import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPageQueryDto } from '../../common/pagination';

export class ListUsersQueryDto extends CursorPageQueryDto {
  @ApiPropertyOptional({ description: 'Buscar por email o nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
