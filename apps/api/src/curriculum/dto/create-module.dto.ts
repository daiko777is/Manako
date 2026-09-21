import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ maxLength: 140 })
  @IsString()
  @MaxLength(140)
  title!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Posición (si se omite, se añade al final)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
