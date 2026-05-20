import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BaselineService } from './baseline.service';

@Controller('projects/:projectId/baselines')
@UseGuards(JwtAuthGuard)
export class BaselineController {
  constructor(private readonly baselineService: BaselineService) {}

  @Post()
  async createBaseline(
    @Param('projectId') projectId: string,
    @Body() body: { description?: string },
    @Request() req: any,
  ) {
    return this.baselineService.createBaseline(
      projectId,
      req.user.id,
      body.description,
    );
  }

  @Get()
  async getBaselineHistory(@Param('projectId') projectId: string) {
    return this.baselineService.getBaselineHistory(projectId);
  }

  @Get(':baselineId')
  async getBaseline(
    @Param('projectId') projectId: string,
    @Param('baselineId') baselineId: string,
  ) {
    return this.baselineService.getBaseline(projectId, baselineId);
  }

  @Get(':baselineId/comparison')
  async getCurrentComparison(
    @Param('projectId') projectId: string,
    @Param('baselineId') baselineId: string,
  ) {
    return this.baselineService.getCurrentComparison(projectId, baselineId);
  }

  @Delete(':baselineId')
  async deleteBaseline(
    @Param('projectId') projectId: string,
    @Param('baselineId') baselineId: string,
  ) {
    return this.baselineService.deleteBaseline(projectId, baselineId);
  }
}
