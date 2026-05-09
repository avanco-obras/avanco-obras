import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScheduleService } from './schedule.service';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';

@ApiTags('Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('projects/:id/schedule')
  @ApiOperation({ summary: 'List all schedule items for a project (flat list)' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns all schedule items ordered by position' })
  findAll(@Param('id') projectId: string) {
    return this.scheduleService.findAll(projectId);
  }

  @Post('projects/:id/schedule')
  @ApiOperation({ summary: 'Create a schedule item for a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Schedule item created successfully' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('id') projectId: string,
    @Body() dto: CreateScheduleItemDto,
  ) {
    return this.scheduleService.create(projectId, dto);
  }

  @Patch('schedule/:id')
  @ApiOperation({ summary: 'Update a schedule item by ID' })
  @ApiParam({ name: 'id', description: 'Schedule item ID' })
  @ApiResponse({ status: 200, description: 'Schedule item updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleItemDto,
  ) {
    return this.scheduleService.update(id, dto);
  }

  @Delete('schedule/:id')
  @ApiOperation({ summary: 'Delete a schedule item and its children' })
  @ApiParam({ name: 'id', description: 'Schedule item ID' })
  @ApiResponse({ status: 200, description: 'Schedule item deleted' })
  remove(@Param('id') id: string) {
    return this.scheduleService.remove(id);
  }

  @Get('projects/:id/schedule/gantt-data')
  @ApiOperation({ summary: 'Get Gantt chart formatted data for a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns Gantt rows with hasChildren flag' })
  getGanttData(@Param('id') projectId: string) {
    return this.scheduleService.getGanttData(projectId);
  }

  @Get('projects/:id/schedule/curva-s')
  @ApiOperation({ summary: 'Get Curva S (S-Curve) monthly data for a project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns monthly cumulative planned vs actual progress' })
  getCurvaS(@Param('id') projectId: string) {
    return this.scheduleService.getCurvaS(projectId);
  }
}
