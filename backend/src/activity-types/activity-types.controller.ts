import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ActivityTypesService } from './activity-types.service';
import { CreateActivityTypeDto } from './dto/create-activity-type.dto';
import { UpdateActivityTypeDto } from './dto/update-activity-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('activity-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ActivityTypesController {
  constructor(private readonly activityTypesService: ActivityTypesService) {}

  @Get('projects/:projectId/activity-types')
  @ApiOperation({ summary: 'List all activity types for a project' })
  @ApiResponse({ status: 200, description: 'Activity types returned successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.activityTypesService.findAll(projectId);
  }

  @Post('projects/:projectId/activity-types')
  @ApiOperation({ summary: 'Create a new activity type in a project' })
  @ApiResponse({ status: 201, description: 'Activity type created successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 409, description: 'Activity type name already exists in this project' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateActivityTypeDto,
  ) {
    return this.activityTypesService.create(projectId, dto);
  }

  @Patch('activity-types/:id')
  @ApiOperation({ summary: 'Update an activity type' })
  @ApiResponse({ status: 200, description: 'Activity type updated successfully' })
  @ApiResponse({ status: 404, description: 'Activity type not found' })
  @ApiResponse({ status: 409, description: 'Activity type name already exists in this project' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityTypeDto,
  ) {
    return this.activityTypesService.update(id, dto);
  }

  @Delete('activity-types/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an activity type' })
  @ApiResponse({ status: 200, description: 'Activity type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Activity type not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.activityTypesService.remove(id);
  }
}
