import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class SetRoleDto {
  @ApiProperty({ enum: ['student', 'instructor', 'admin'] })
  @IsEnum(['student', 'instructor', 'admin'])
  role!: 'student' | 'instructor' | 'admin';
}
