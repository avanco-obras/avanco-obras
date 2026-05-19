import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { PrismaService } from '../common/prisma.service';

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

  async upload(
    projectId: string,
    file: Express.Multer.File,
    category: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    const storageKey = `${projectId}/${category}/${Date.now()}-${file.originalname}`;

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
        fileName: file.originalname,
        fileType: file.mimetype,
        category,
        storageKey,
        fileSize: file.size,
      },
    });

    return upload;
  }

  async findAll(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
    }

    return this.prisma.upload.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
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
