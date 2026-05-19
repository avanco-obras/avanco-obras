import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaService } from './common/prisma.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TowersModule } from './towers/towers.module';
import { ActivityTypesModule } from './activity-types/activity-types.module';
import { ScheduleModule } from './schedule/schedule.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { WeeklyPlanningModule } from './weekly-planning/weekly-planning.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadsModule } from './uploads/uploads.module';
import { AiImportModule } from './ai-import/ai-import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    ProjectsModule,
    TowersModule,
    ActivityTypesModule,
    ScheduleModule,
    MeasurementsModule,
    WeeklyPlanningModule,
    DashboardModule,
    UploadsModule,
    AiImportModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
