import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ProgressItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ description: 'Segundos vistos (monótono creciente)' })
  @IsInt()
  @Min(0)
  watchedSeconds!: number;
}

export class UpdateProgressDto {
  @ApiProperty({ type: [ProgressItemDto], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProgressItemDto)
  items!: ProgressItemDto[];
}
