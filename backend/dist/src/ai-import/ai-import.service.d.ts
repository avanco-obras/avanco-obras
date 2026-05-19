import { ConfigService } from '@nestjs/config';
import { AiImportResultDto } from './dto/ai-import-result.dto';
export declare class AiImportService {
    private readonly config;
    private mistral;
    private modelName;
    constructor(config: ConfigService);
    analyzePdf(fileBuffer: Buffer, _mimeType: string): Promise<AiImportResultDto>;
    private parseAiResponse;
    private buildFallback;
    private defaultActivityTypes;
    private buildDefaultSchedule;
}
