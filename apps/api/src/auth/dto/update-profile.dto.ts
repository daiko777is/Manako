import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ description: 'URL pública del avatar' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string;
}
