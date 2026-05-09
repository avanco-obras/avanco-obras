import {
  Controller,
  Get,
  Post,
  Patch,
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
import { WeeklyPlanningService } from './weekly-planning.service';
import { CreateWeeklyPlanDto } from './dto/create-weekly-plan.dto';
import { CreateWeeklyTaskDto } from './dto/create-weekly-task.dto';
import { UpdateWeeklyTaskDto } from './dto/update-weekly-task.dto';
import { CreateRestrictionDto } from './dto/create-restriction.dto';
import { UpdateRestrictionDto } from './dto/update-restriction.dto';

@ApiTags('Weekly Planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WeeklyPlanningController {
  constructor(private readonly weeklyPlanningService: WeeklyPlanningService) {}

  @Get('projects/:projectId/weekly-plans')
  @ApiOperation({ summary: 'List all weekly plans for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns all weekly plans ordered by year and week (newest first)' })
  findAll(@Param('projectId') projectId: string) {
    return this.weeklyPlanningService.findAll(projectId);
  }

  @Post('projects/:projectId/weekly-plans')
  @ApiOperation({ summary: 'Create a weekly plan for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 201, description: 'Weekly plan created successfully' })
  @ApiResponse({ status: 409, description: 'A plan already exists for this week/year in the project' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWeeklyPlanDto,
  ) {
    return this.weeklyPlanningService.create(projectId, dto);
  }

  @Get('weekly-plans/:id')
  @ApiOperation({ summary: 'Get a weekly plan by ID (includes tasks and restrictions)' })
  @ApiParam({ name: 'id', description: 'Weekly Plan ID' })
  @ApiResponse({ status: 200, description: 'Returns the weekly plan with tasks and restrictions' })
  findOne(@Param('id') id: string) {
    return this.weeklyPlanningService.findOne(id);
  }

  @Post('weekly-plans/:id/tasks')
  @ApiOperation({ summary: 'Add a task to a weekly plan' })
  @ApiParam({ name: 'id', description: 'Weekly Plan ID' })
  @ApiResponse({ status: 201, description: 'Task added to the plan successfully' })
  @HttpCode(HttpStatus.CREATED)
  addTask(
    @Param('id') planId: string,
    @Body() dto: CreateWeeklyTaskDto,
  ) {
    return this.weeklyPlanningService.addTask(planId, dto);
  }

  @Patch('weekly-tasks/:id')
  @ApiOperation({ summary: 'Update a weekly task by ID' })
  @ApiParam({ name: 'id', description: 'Weekly Task ID' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  updateTask(
    @Param('id') taskId: string,
    @Body() dto: UpdateWeeklyTaskDto,
  ) {
    return this.weeklyPlanningService.updateTask(taskId, dto);
  }

  @Post('weekly-plans/:id/restrictions')
  @ApiOperation({ summary: 'Add a restriction to a weekly plan' })
  @ApiParam({ name: 'id', description: 'Weekly Plan ID' })
  @ApiResponse({ status: 201, description: 'Restriction added to the plan successfully' })
  @HttpCode(HttpStatus.CREATED)
  addRestriction(
    @Param('id') planId: string,
    @Body() dto: CreateRestrictionDto,
  ) {
    return this.weeklyPlanningService.addRestriction(planId, dto);
  }

  @Patch('restrictions/:id')
  @ApiOperation({ summary: 'Update a restriction by ID' })
  @ApiParam({ name: 'id', description: 'Restriction ID' })
  @ApiResponse({ status: 200, description: 'Restriction updated successfully; resolvedAt is set automatically when status becomes RELEASED' })
  updateRestriction(
    @Param('id') restrictionId: string,
    @Body() dto: UpdateRestrictionDto,
  ) {
    return this.weeklyPlanningService.updateRestriction(restrictionId, dto);
  }

  @Get('projects/:projectId/weekly-plans/ppc-history')
  @ApiOperation({ summary: 'Get last 12 weeks PPC history for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns PPC actual (recalculated from tasks) and target per week' })
  getPPCHistory(@Param('projectId') projectId: string) {
    return this.weeklyPlanningService.getPPCHistory(projectId);
  }

  @Post('weekly-plans/:id/generate')
  @ApiOperation({ summary: 'Generate weekly tasks from overlapping schedule items' })
  @ApiParam({ name: 'id', description: 'Weekly Plan ID' })
  @ApiResponse({ status: 201, description: 'Tasks generated from schedule items that overlap the plan period' })
  @HttpCode(HttpStatus.CREATED)
  generateFromSchedule(@Param('id') planId: string) {
    return this.weeklyPlanningService.generateFromSchedule(planId);
  }
}
