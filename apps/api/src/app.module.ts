import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CoursesModule } from './courses/courses.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { HealthController } from './health.controller';
import { InstructorsModule } from './instructors/instructors.module';
import { JsonLoggingInterceptor } from './common/json-logging.interceptor';
import { PaymentsModule } from './payments/payments.module';
import { PlaybackModule } from './playback/playback.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgressModule } from './progress/progress.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv as never, cache: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLE_TTL_SECONDS') ?? 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 100,
          },
        ],
      }),
    }),
    PrismaModule,
    FeatureFlagsModule,
    AuthModule,
    InstructorsModule,
    CoursesModule,
    CurriculumModule,
    PlaybackModule,
    EnrollmentsModule,
    ProgressModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guards globales: primero autenticación (JWT de Supabase), luego RBAC.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: JsonLoggingInterceptor },
  ],
})
export class AppModule {}
