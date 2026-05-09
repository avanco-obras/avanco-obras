"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const minio_1 = require("minio");
const prisma_service_1 = require("../common/prisma.service");
let UploadsService = UploadsService_1 = class UploadsService {
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(UploadsService_1.name);
        this.bucket = this.configService.get('minio.bucket') ?? 'avanco-obras';
        this.minioClient = new minio_1.Client({
            endPoint: this.configService.get('minio.endpoint') ?? 'localhost',
            port: this.configService.get('minio.port') ?? 9000,
            useSSL: this.configService.get('minio.useSSL') ?? false,
            accessKey: this.configService.get('minio.accessKey') ?? 'minioadmin',
            secretKey: this.configService.get('minio.secretKey') ?? 'minioadmin',
        });
    }
    async onModuleInit() {
        await this.ensureBucket();
    }
    async ensureBucket() {
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
                await this.minioClient.setBucketPolicy(this.bucket, JSON.stringify(policy));
                this.logger.log(`Public read policy set on bucket "${this.bucket}"`);
            }
            else {
                this.logger.log(`Bucket "${this.bucket}" already exists`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to initialize MinIO bucket: ${err.message}`);
        }
    }
    async upload(projectId, file, category) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        const storageKey = `${projectId}/${category}/${Date.now()}-${file.originalname}`;
        await this.minioClient.putObject(this.bucket, storageKey, file.buffer, file.size, { 'Content-Type': file.mimetype });
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
    async findAll(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });
        if (!project) {
            throw new common_1.NotFoundException(`Projeto com ID "${projectId}" não encontrado`);
        }
        return this.prisma.upload.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async delete(id) {
        const upload = await this.prisma.upload.findUnique({
            where: { id },
        });
        if (!upload) {
            throw new common_1.NotFoundException(`Upload com ID "${id}" não encontrado`);
        }
        await this.minioClient.removeObject(this.bucket, upload.storageKey);
        await this.prisma.upload.delete({ where: { id } });
        return { message: 'Arquivo excluído com sucesso' };
    }
    async getPresignedUrl(storageKey) {
        return this.minioClient.presignedGetObject(this.bucket, storageKey, 3600);
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map