import { Module } from '@nestjs/common';
import { WeeklyPlanningController } from './weekly-planning.controller';
import { WeeklyPlanningService } from './weekly-planning.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [WeeklyPlanningController],
  providers: [WeeklyPlanningService, PrismaService],
  exports: [WeeklyPlanningService],
})
export class WeeklyPlanningModule {}
