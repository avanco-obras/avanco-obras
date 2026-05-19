import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
export declare class UploadsService implements OnModuleInit {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private readonly minioClient;
    private readonly bucket;
    constructor(configService: ConfigService, prisma: PrismaService);
    onModuleInit(): Promise<void>;
    ensureBucket(): Promise<void>;
    upload(projectId: string, file: Express.Multer.File, category: string): Promise<{
        id: string;
        createdAt: Date;
        projectId: string;
        fileName: string;
        fileType: string;
        category: string;
        storageKey: string;
        fileSize: number;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    findAll(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        projectId: string;
        fileName: string;
        fileType: string;
        category: string;
        storageKey: string;
        fileSize: number;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    delete(id: string): Promise<{
        message: string;
    }>;
    getPresignedUrl(storageKey: string): Promise<string>;
}
