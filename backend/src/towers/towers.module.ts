import { Module } from '@nestjs/common';
import { TowersService } from './towers.service';
import { TowersController } from './towers.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [TowersController],
  providers: [TowersService, PrismaService],
  exports: [TowersService],
})
export class TowersModule {}
