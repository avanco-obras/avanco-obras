import { Module } from '@nestjs/common';
import { ActivityTypesService } from './activity-types.service';
import { ActivityTypesController } from './activity-types.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ActivityTypesController],
  providers: [ActivityTypesService, PrismaService],
  exports: [ActivityTypesService],
})
export class ActivityTypesModule {}
