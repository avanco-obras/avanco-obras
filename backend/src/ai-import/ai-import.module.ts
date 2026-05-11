import { Module } from '@nestjs/common';
import { AiImportController } from './ai-import.controller';
import { AiImportService } from './ai-import.service';

@Module({
  controllers: [AiImportController],
  providers: [AiImportService],
})
export class AiImportModule {}
