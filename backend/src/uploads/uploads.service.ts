import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { PrismaService } from '../common/prisma.service';

export const UPLOAD_CATEGORIES = ['IFC_MODEL', 'FLOOR_PLAN', 'PHOTO', 'REPORT', 'PLANT', 'general'] as const;
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

const EXT_BY_CATEGORY: Partial<Record<UploadCategory, string[]>> = {
  IFC_MODEL: ['.ifc'],
  FLOOR_PLAN: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  PHOTO: ['.png', '.jpg', '.jpeg', '.webp', '.heic'],
  REPORT: ['.pdf'],
  PLANT: ['.pdf', '.png', '.jpg', '.jpeg'],
};

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private readonly minioClient: MinioClient;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.configService.get<string>('minio.bucket') ?? 'avanco-obras';

    const minioPort = this.configService.get<number | undefined>('minio.port');
    this.minioClient = new MinioClient({
      endPoint: this.configService.get<string>('minio.endpoint') ?? 'localhost',
      ...(minioPort !== undefined && { port: minioPort }),
      useSSL: this.configService.get<boolean>('minio.useSSL') ?? false,
      accessKey: this.configService.get<string>('minio.accessKey') ?? 'minioadmin',
      secretKey: this.configService.get<string>('minio.secretKey') ?? 'minioadmin',
    });
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" created`);

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };

        await this.minioClient.setBucketPolicy(
          this.bucket,
          JSON.stringify(policy),
        );
        this.logger.log(`Public read policy set on bucket "${this.bucket}"`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize MinIO bucket: ${(err as Error).message}`);
    }
  }

  private validateExtension(category: UploadCategory, fileName: string) {
    const allowed = EXT_BY_CATEGORY[category];
    if (!allowed) return;
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    if (!allowed.includes(ext)) {
      throw new BadRequestException(
        `Extensão "${ext}" não permitida para categoria ${category}. Use: ${allowed.join(', ')}`,
      );
    }
  }

  async upload(
    projectId: string,
    file: Express.Multer.File,
    category: string,
    floorId?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const cat = (UPLOAD_CATEGORIES.includes(category as UploadCategory)
      ? category
      : 'general') as UploadCategory;

    this.validateExtension(cat, file.originalname);

    if (cat === 'FLOOR_PLAN' && !floorId) {
      throw new BadRequestException('floorId é obrigatório para FLOOR_PLAN');
    }

    if (floorId) {
      const floor = await this.prisma.floor.findFirst({
        where: { id: floorId, tower: { projectId } },
        select: { id: true },
      });
      if (!floor) {
        throw new NotFoundException(`Pavimento "${floorId}" não encontrado no projeto`);
      }
    }

    if (cat === 'IFC_MODEL') {
      const existing = await this.prisma.upload.findMany({
        where: { projectId, category: 'IFC_MODEL' },
      });
      for (const old of existing) {
        try {
          await this.minioClient.removeObject(this.bucket, old.storageKey);
        } catch (err) {
          this.logger.warn(`Falha ao remover IFC antigo: ${(err as Error).message}`);
        }
        await this.prisma.upload.delete({ where: { id: old.id } });
      }
    }

    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
    const storageKey = `${projectId}/${cat.toLowerCase()}/${Date.now()}-${safeName}`;

    await this.minioClient.putObject(
      this.bucket,
      storageKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    const upload = await this.prisma.upload.create({
      data: {
        projectId,
        floorId: floorId ?? null,
        fileName: file.originalname,
        fileType: file.mimetype,
        category: cat,
        storageKey,
        fileSize: file.size,
      },
    });

    return upload;
  }

  async findAll(projectId: string, filter?: { category?: string; floorId?: string }) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.upload.findMany({
      where: {
        projectId,
        ...(filter?.category && { category: filter.category }),
        ...(filter?.floorId && { floorId: filter.floorId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIfcModel(projectId: string) {
    const ifc = await this.prisma.upload.findFirst({
      where: { projectId, category: 'IFC_MODEL' },
      orderBy: { createdAt: 'desc' },
    });
    if (!ifc) return null;
    const url = await this.getPresignedUrl(ifc.storageKey);
    return { ...ifc, url };
  }

  async listFloorPlans(floorId: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      select: { id: true },
    });
    if (!floor) {
      throw new NotFoundException(`Pavimento "${floorId}" não encontrado`);
    }
    const plans = await this.prisma.upload.findMany({
      where: { floorId, category: 'FLOOR_PLAN' },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      plans.map(async (p) => ({ ...p, url: await this.getPresignedUrl(p.storageKey) })),
    );
  }

  async delete(id: string) {
    const upload = await this.prisma.upload.findUnique({
      where: { id },
    });
    if (!upload) {
      throw new NotFoundException(`Upload com ID "${id}" não encontrado`);
    }

    await this.minioClient.removeObject(this.bucket, upload.storageKey);
    await this.prisma.upload.delete({ where: { id } });

    return { message: 'Arquivo excluído com sucesso' };
  }

  async getPresignedUrl(storageKey: string): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucket, storageKey, 3600);
  }
}
