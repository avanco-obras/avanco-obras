import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiImportService } from './ai-import.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects/:projectId/ai-import')
@UseGuards(JwtAuthGuard)
export class AiImportController {
  constructor(private readonly aiImportService: AiImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Apenas arquivos PDF são aceitos'), false);
        }
      },
    }),
  )
  async analyzePdf(
    @Param('projectId') _projectId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado. Envie um PDF no campo "file".');
    }
    return this.aiImportService.analyzePdf(file.buffer, file.mimetype);
  }
}
