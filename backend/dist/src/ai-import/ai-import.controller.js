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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiImportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const ai_import_service_1 = require("./ai-import.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let AiImportController = class AiImportController {
    constructor(aiImportService) {
        this.aiImportService = aiImportService;
    }
    async analyzePdf(_projectId, file) {
        if (!file) {
            throw new common_1.BadRequestException('Nenhum arquivo enviado. Envie um PDF no campo "file".');
        }
        return this.aiImportService.analyzePdf(file.buffer, file.mimetype);
    }
};
exports.AiImportController = AiImportController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: 20 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
                cb(null, true);
            }
            else {
                cb(new common_1.BadRequestException('Apenas arquivos PDF são aceitos'), false);
            }
        },
    })),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AiImportController.prototype, "analyzePdf", null);
exports.AiImportController = AiImportController = __decorate([
    (0, common_1.Controller)('projects/:projectId/ai-import'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ai_import_service_1.AiImportService])
], AiImportController);
//# sourceMappingURL=ai-import.controller.js.map