import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TowersService } from './towers.service';
import { CreateTowerDto } from './dto/create-tower.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('towers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TowersController {
  constructor(private readonly towersService: TowersService) {}

  @Get('projects/:projectId/towers')
  @ApiOperation({ summary: 'List all towers in a project' })
  @ApiResponse({ status: 200, description: 'Towers list returned successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  listTowers(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.towersService.listTowers(projectId);
  }

  @Post('projects/:projectId/towers')
  @ApiOperation({ summary: 'Create a new tower in a project' })
  @ApiResponse({ status: 201, description: 'Tower created successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  createTower(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTowerDto,
  ) {
    return this.towersService.createTower(projectId, dto);
  }

  @Get('projects/:projectId/towers/:towerId/floors')
  @ApiOperation({ summary: 'List all floors in a tower' })
  @ApiResponse({ status: 200, description: 'Floors list returned successfully' })
  @ApiResponse({ status: 404, description: 'Tower not found' })
  listFloors(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('towerId', ParseUUIDPipe) towerId: string,
  ) {
    return this.towersService.listFloors(towerId);
  }

  @Post('projects/:projectId/towers/:towerId/floors')
  @ApiOperation({ summary: 'Create a new floor in a tower' })
  @ApiResponse({ status: 201, description: 'Floor created successfully' })
  @ApiResponse({ status: 404, description: 'Tower not found' })
  createFloor(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('towerId', ParseUUIDPipe) towerId: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.towersService.createFloor(towerId, dto);
  }

  @Get('floors/:floorId/units')
  @ApiOperation({ summary: 'List all units in a floor' })
  @ApiResponse({ status: 200, description: 'Units list returned successfully' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  listUnits(@Param('floorId', ParseUUIDPipe) floorId: string) {
    return this.towersService.listUnits(floorId);
  }

  @Post('floors/:floorId/units')
  @ApiOperation({ summary: 'Create a new unit in a floor' })
  @ApiResponse({ status: 201, description: 'Unit created successfully' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  createUnit(
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.towersService.createUnit(floorId, dto);
  }
}
