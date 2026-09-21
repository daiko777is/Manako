import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyInstructorDto {
  @ApiPropertyOptional({ maxLength: 160, description: 'Frase corta que te describe' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}
