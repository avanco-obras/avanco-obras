import { AiImportService } from './ai-import.service';
export declare class AiImportController {
    private readonly aiImportService;
    constructor(aiImportService: AiImportService);
    analyzePdf(_projectId: string, file: Express.Multer.File): Promise<import("./dto/ai-import-result.dto").AiImportResultDto>;
}
