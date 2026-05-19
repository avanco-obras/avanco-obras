import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('projects/:projectId/dashboard')
  @ApiOperation({ summary: 'Get consolidated KPIs for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns KPIs including progress, SPI, PPC and activity counts' })
  getKPIs(@Param('projectId') projectId: string) {
    return this.dashboardService.getKPIs(projectId);
  }

  @Get('projects/:projectId/dashboard/delays')
  @ApiOperation({ summary: 'Get top 10 delayed schedule items for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns top 10 items with largest gap between planned and actual progress' })
  getDelays(@Param('projectId') projectId: string) {
    return this.dashboardService.getDelays(projectId);
  }

  @Get('projects/:projectId/dashboard/restrictions')
  @ApiOperation({ summary: 'Get pending restrictions for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns restrictions with PENDING or IN_ANALYSIS status, including weekly plan data' })
  getPendingRestrictions(@Param('projectId') projectId: string) {
    return this.dashboardService.getPendingRestrictions(projectId);
  }

  @Get('projects/:projectId/dashboard/spi')
  @ApiOperation({ summary: 'Get monthly SPI history for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns monthly SPI history from project start date to now' })
  getSPIHistory(@Param('projectId') projectId: string) {
    return this.dashboardService.getSPIHistory(projectId);
  }
}
