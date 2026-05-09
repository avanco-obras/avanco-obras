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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { BatchMeasurementDto } from './dto/batch-measurement.dto';

@ApiTags('Measurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Get('units/:unitId/measurements')
  @ApiOperation({ summary: 'List all measurements for a unit' })
  @ApiParam({ name: 'unitId', description: 'Unit ID' })
  @ApiResponse({ status: 200, description: 'Returns all measurements for the unit, including activityType' })
  findByUnit(@Param('unitId') unitId: string) {
    return this.measurementsService.findByUnit(unitId);
  }

  @Post('units/:unitId/measurements')
  @ApiOperation({ summary: 'Create a measurement for a unit' })
  @ApiParam({ name: 'unitId', description: 'Unit ID' })
  @ApiResponse({ status: 201, description: 'Measurement created successfully' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('unitId') unitId: string,
    @CurrentUser('id') measuredById: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    return this.measurementsService.create(unitId, measuredById, dto);
  }

  @Patch('measurements/:id')
  @ApiOperation({ summary: 'Update a measurement by ID' })
  @ApiParam({ name: 'id', description: 'Measurement ID' })
  @ApiResponse({ status: 200, description: 'Measurement updated successfully' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMeasurementDto>,
  ) {
    return this.measurementsService.update(id, dto);
  }

  @Post('units/:unitId/measurements/batch')
  @ApiOperation({ summary: 'Batch create measurements for a unit' })
  @ApiParam({ name: 'unitId', description: 'Unit ID' })
  @ApiResponse({ status: 201, description: 'Measurements created in batch successfully' })
  @HttpCode(HttpStatus.CREATED)
  batchCreate(
    @Param('unitId') unitId: string,
    @CurrentUser('id') measuredById: string,
    @Body() dto: BatchMeasurementDto,
  ) {
    return this.measurementsService.batchCreate(unitId, measuredById, dto);
  }

  @Get('projects/:projectId/measurements/summary')
  @ApiOperation({ summary: 'Get measurements summary aggregated per floor for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns average progress per floor across all towers' })
  getSummary(@Param('projectId') projectId: string) {
    return this.measurementsService.getSummary(projectId);
  }

  @Get('projects/:projectId/measurements/building-data')
  @ApiOperation({ summary: 'Get building visualization data for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Returns tower/floor/unit progress data for SVG building view' })
  getBuildingData(@Param('projectId') projectId: string) {
    return this.measurementsService.getBuildingData(projectId);
  }
}
