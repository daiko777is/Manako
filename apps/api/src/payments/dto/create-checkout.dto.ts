import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ format: 'uuid', description: 'Curso a comprar/inscribirse' })
  @IsUUID()
  courseId!: string;
}
