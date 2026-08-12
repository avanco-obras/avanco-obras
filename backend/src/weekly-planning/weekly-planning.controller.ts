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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WeeklyPlanningService } from './weekly-planning.service';
import { CreateWeeklyProgramDto } from './dto/create-weekly-program.dto';
import { CreateWeeklyActivityDto } from './dto/create-weekly-activity.dto';
import { UpdateWeeklyActivityDto } from './dto/update-weekly-activity.dto';
import { CreateWeeklyRestrictionDto } from './dto/create-weekly-restriction.dto';
import { UpdateWeeklyRestrictionDto } from './dto/update-weekly-restriction.dto';
import { CreateContractorDto, UpdateContractorDto } from './dto/contractor.dto';
import { CreateRestrictionTypeDto, UpdateRestrictionTypeDto } from './dto/restriction-type.dto';

@ApiTags('Programação Semanal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WeeklyPlanningController {
  constructor(private readonly service: WeeklyPlanningService) {}

  // ── Programações ──────────────────────────────────────────────────────────

  @Get('projects/:projectId/weekly-programs')
  @ApiOperation({ summary: 'Lista programações semanais do projeto' })
  @ApiParam({ name: 'projectId' })
  list(@Param('projectId') projectId: string) {
    return this.service.list(projectId);
  }

  @Post('projects/:projectId/weekly-programs')
  @ApiOperation({ summary: 'Cria a programação da semana que contém a data de referência (default: hoje)' })
  @ApiParam({ name: 'projectId' })
  @ApiResponse({ status: 409, description: 'Já existe programação para a semana' })
  @HttpCode(HttpStatus.CREATED)
  create(@Param('projectId') projectId: string, @Body() dto: CreateWeeklyProgramDto) {
    return this.service.create(projectId, dto);
  }

  @Get('projects/:projectId/weekly-programs/ppc-history')
  @ApiOperation({ summary: 'Histórico de PPC das últimas 12 semanas' })
  @ApiParam({ name: 'projectId' })
  ppcHistory(@Param('projectId') projectId: string) {
    return this.service.ppcHistory(projectId);
  }

  @Get('weekly-programs/:id')
  @ApiOperation({ summary: 'Detalhe da programação (atividades + restrições + vínculos)' })
  @ApiParam({ name: 'id' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('weekly-programs/:id/refresh')
  @ApiOperation({ summary: 'Atualizar Programação: importa cronograma + reprogramadas, sem duplicar nem sobrescrever' })
  @ApiParam({ name: 'id' })
  refresh(@Param('id') id: string) {
    return this.service.refresh(id);
  }

  @Post('weekly-programs/:id/publish')
  @ApiOperation({ summary: 'Publicar Programação (RASCUNHO → PUBLICADA, gera snapshot)' })
  @ApiParam({ name: 'id' })
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.publish(id, userId);
  }

  @Post('weekly-programs/:id/close')
  @ApiOperation({ summary: 'Publicar Fechamento: indicadores + snapshot + cria próxima semana com reprogramadas (transacional)' })
  @ApiParam({ name: 'id' })
  close(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.close(id, userId);
  }

  @Post('weekly-programs/:id/report')
  @ApiOperation({ summary: 'Gravar Report (snapshot do momento)' })
  @ApiParam({ name: 'id' })
  @HttpCode(HttpStatus.CREATED)
  report(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.report(id, userId);
  }

  @Get('weekly-programs/:id/snapshots')
  @ApiOperation({ summary: 'Histórico de snapshots da programação' })
  @ApiParam({ name: 'id' })
  snapshots(@Param('id') id: string) {
    return this.service.listSnapshots(id);
  }

  @Get('weekly-snapshots/:id')
  @ApiOperation({ summary: 'Conteúdo de um snapshot (imutável)' })
  @ApiParam({ name: 'id' })
  snapshot(@Param('id') id: string) {
    return this.service.getSnapshot(id);
  }

  @Get('weekly-programs/:id/indicators')
  @ApiOperation({ summary: 'Indicadores live da programação (PPC, reprogramadas, restrições, por empreiteira/responsável)' })
  @ApiParam({ name: 'id' })
  indicators(@Param('id') id: string) {
    return this.service.indicators(id);
  }

  // ── Atividades ────────────────────────────────────────────────────────────

  @Post('weekly-programs/:id/activities')
  @ApiOperation({ summary: 'Adiciona atividade manual (extra) à programação' })
  @ApiParam({ name: 'id' })
  @HttpCode(HttpStatus.CREATED)
  addActivity(@Param('id') id: string, @Body() dto: CreateWeeklyActivityDto) {
    return this.service.addActivity(id, dto);
  }

  @Patch('weekly-activities/:id')
  @ApiOperation({ summary: 'Atualiza atividade (aplica regras Status ↔ %)' })
  @ApiParam({ name: 'id' })
  updateActivity(@Param('id') id: string, @Body() dto: UpdateWeeklyActivityDto) {
    return this.service.updateActivity(id, dto);
  }

  @Delete('weekly-activities/:id')
  @ApiOperation({ summary: 'Remove atividade da programação' })
  @ApiParam({ name: 'id' })
  removeActivity(@Param('id') id: string) {
    return this.service.removeActivity(id);
  }

  // ── Restrições ────────────────────────────────────────────────────────────

  @Post('weekly-programs/:id/restrictions')
  @ApiOperation({ summary: 'Cria restrição vinculada a N atividades' })
  @ApiParam({ name: 'id' })
  @HttpCode(HttpStatus.CREATED)
  addRestriction(@Param('id') id: string, @Body() dto: CreateWeeklyRestrictionDto) {
    return this.service.addRestriction(id, dto);
  }

  @Patch('weekly-restrictions/:id')
  @ApiOperation({ summary: 'Atualiza restrição (resolvedAt automático ao marcar RESOLVIDA)' })
  @ApiParam({ name: 'id' })
  updateRestriction(@Param('id') id: string, @Body() dto: UpdateWeeklyRestrictionDto) {
    return this.service.updateRestriction(id, dto);
  }

  @Delete('weekly-restrictions/:id')
  @ApiOperation({ summary: 'Remove restrição' })
  @ApiParam({ name: 'id' })
  removeRestriction(@Param('id') id: string) {
    return this.service.removeRestriction(id);
  }

  // ── Empreiteiras ──────────────────────────────────────────────────────────

  @Get('projects/:projectId/contractors')
  @ApiOperation({ summary: 'Lista empreiteiras do projeto' })
  @ApiParam({ name: 'projectId' })
  listContractors(@Param('projectId') projectId: string) {
    return this.service.listContractors(projectId);
  }

  @Post('projects/:projectId/contractors')
  @ApiOperation({ summary: 'Cadastra empreiteira' })
  @ApiParam({ name: 'projectId' })
  @HttpCode(HttpStatus.CREATED)
  createContractor(@Param('projectId') projectId: string, @Body() dto: CreateContractorDto) {
    return this.service.createContractor(projectId, dto);
  }

  @Patch('contractors/:id')
  @ApiOperation({ summary: 'Atualiza empreiteira' })
  @ApiParam({ name: 'id' })
  updateContractor(@Param('id') id: string, @Body() dto: UpdateContractorDto) {
    return this.service.updateContractor(id, dto);
  }

  @Delete('contractors/:id')
  @ApiOperation({ summary: 'Remove empreiteira' })
  @ApiParam({ name: 'id' })
  removeContractor(@Param('id') id: string) {
    return this.service.removeContractor(id);
  }

  // ── Tipos de restrição ────────────────────────────────────────────────────

  @Get('projects/:projectId/restriction-types')
  @ApiOperation({ summary: 'Lista tipos de restrição do projeto' })
  @ApiParam({ name: 'projectId' })
  listRestrictionTypes(@Param('projectId') projectId: string) {
    return this.service.listRestrictionTypes(projectId);
  }

  @Post('projects/:projectId/restriction-types')
  @ApiOperation({ summary: 'Cadastra tipo de restrição' })
  @ApiParam({ name: 'projectId' })
  @HttpCode(HttpStatus.CREATED)
  createRestrictionType(@Param('projectId') projectId: string, @Body() dto: CreateRestrictionTypeDto) {
    return this.service.createRestrictionType(projectId, dto);
  }

  @Patch('restriction-types/:id')
  @ApiOperation({ summary: 'Atualiza tipo de restrição' })
  @ApiParam({ name: 'id' })
  updateRestrictionType(@Param('id') id: string, @Body() dto: UpdateRestrictionTypeDto) {
    return this.service.updateRestrictionType(id, dto);
  }

  @Delete('restriction-types/:id')
  @ApiOperation({ summary: 'Remove tipo de restrição' })
  @ApiParam({ name: 'id' })
  removeRestrictionType(@Param('id') id: string) {
    return this.service.removeRestrictionType(id);
  }
}
