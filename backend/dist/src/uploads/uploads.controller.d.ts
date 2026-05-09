import { UploadsService } from './uploads.service';
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
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
}
