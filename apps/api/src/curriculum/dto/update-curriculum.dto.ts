import { PartialType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';
import { CreateLessonDto } from './create-lesson.dto';

export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
