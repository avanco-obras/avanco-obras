import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, PrismaService],
  exports: [UploadsService],
})
export class UploadsModule {}
