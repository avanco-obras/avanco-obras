import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhysicalProgressService } from './physical-progress.service';

@Controller('projects/:projectId/physical-progress')
@UseGuards(JwtAuthGuard)
export class PhysicalProgressController {
  constructor(private readonly progressService: PhysicalProgressService) {}

  @Get('metrics')
  async getMetrics(@Param('projectId') projectId: string) {
    return this.progressService.getProjectMetrics(projectId);
  }

  @Post('report')
  async createReport(
    @Param('projectId') projectId: string,
    @Body() body: { description?: string },
    @Request() req: any,
  ) {
    return this.progressService.createReport(projectId, req.user.id, body.description);
  }

  @Get('reports')
  async getReportHistory(@Param('projectId') projectId: string) {
    return this.progressService.getReportHistory(projectId);
  }

  @Get('reports/:reportId')
  async getReport(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.progressService.getReportWithComparison(projectId, reportId);
  }

  /**
   * Restaura o projeto para o estado deste Report, sobrescrevendo os dados
   * atuais. Grava um Report de segurança antes, para que dê para voltar.
   */
  @Post('reports/:reportId/restore')
  async restoreReport(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @Request() req: any,
  ) {
    return this.progressService.restoreReport(projectId, reportId, req.user.id);
  }
}
