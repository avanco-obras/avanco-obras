import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('projects/:projectId/uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'category', description: 'IFC_MODEL | FLOOR_PLAN | PHOTO | REPORT | PLANT | general', required: true })
  @ApiQuery({ name: 'floorId', description: 'Required when category=FLOOR_PLAN', required: false })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category: string,
    @Query('floorId') floorId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.uploadsService.upload(projectId, file, category ?? 'general', floorId);
  }

  @Get('projects/:projectId/uploads')
  @ApiOperation({ summary: 'List uploads for a project (filterable by category/floorId)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'floorId', required: false })
  findAll(
    @Param('projectId') projectId: string,
    @Query('category') category?: string,
    @Query('floorId') floorId?: string,
  ) {
    return this.uploadsService.findAll(projectId, { category, floorId });
  }

  @Get('projects/:projectId/uploads/ifc-model')
  @ApiOperation({ summary: 'Get the active IFC model for a project with a presigned URL' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  getIfcModel(@Param('projectId') projectId: string) {
    return this.uploadsService.getIfcModel(projectId);
  }

  @Get('floors/:floorId/plans')
  @ApiOperation({ summary: 'List 2D plans (PDF/image) for a floor with presigned URLs' })
  @ApiParam({ name: 'floorId', description: 'Floor ID' })
  listFloorPlans(@Param('floorId') floorId: string) {
    return this.uploadsService.listFloorPlans(floorId);
  }

  @Delete('uploads/:id')
  @ApiOperation({ summary: 'Delete an upload by ID' })
  @ApiParam({ name: 'id', description: 'Upload ID' })
  @ApiResponse({ status: 200, description: 'Upload deleted successfully' })
  delete(@Param('id') id: string) {
    return this.uploadsService.delete(id);
  }
}
