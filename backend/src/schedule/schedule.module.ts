import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { BaselineController } from './baseline.controller';
import { BaselineService } from './baseline.service';
import { PhysicalProgressController } from './physical-progress.controller';
import { PhysicalProgressService } from './physical-progress.service';
import { PrismaService } from '../common/prisma.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [ScheduleController, BaselineController, PhysicalProgressController],
  providers: [ScheduleService, BaselineService, PhysicalProgressService, PrismaService],
  exports: [ScheduleService, BaselineService, PhysicalProgressService],
})
export class ScheduleModule {}
