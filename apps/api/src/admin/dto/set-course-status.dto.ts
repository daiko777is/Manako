import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class SetCourseStatusDto {
  @ApiProperty({ enum: ['draft', 'published', 'archived'] })
  @IsEnum(['draft', 'published', 'archived'])
  status!: 'draft' | 'published' | 'archived';
}
