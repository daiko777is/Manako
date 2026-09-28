import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DemoLoginDto {
  @ApiProperty({ example: 'estudiante@manako.demo' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Nombre para cuentas nuevas (registro demo)', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
