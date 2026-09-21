import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CoursesModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
