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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiImportService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mistralai_1 = require("@mistralai/mistralai");
const CONSTRUCTION_PROMPT = `Você é um especialista em engenharia civil e gerenciamento de obras no Brasil.
Analise este documento PDF (livro de plantas / memorial descritivo / caderno técnico) de um empreendimento imobiliário e extraia as seguintes informações em formato JSON.

Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem blocos de código. Apenas o JSON puro.

Estrutura esperada:
{
  "projectInfo": {
    "name": "nome do empreendimento se mencionado, ou null",
    "totalArea": número em m² ou null,
    "towers": número de torres/blocos (mínimo 1),
    "floorsPerTower": número de pavimentos por torre (incluindo térreo),
    "unitsPerFloor": número de unidades por pavimento típico,
    "estimatedDurationMonths": estimativa de meses de obra ou null,
    "buildingType": "RESIDENCIAL" | "COMERCIAL" | "MISTO"
  },
  "activityTypes": [
    {
      "name": "nome da atividade em português",
      "unit": "m²" | "%" | "un" | "m³" | "m",
      "measurementMethod": "METRIC" | "PERCENT" | "COUNT",
      "weight": peso relativo entre 0.5 e 2.0
    }
  ],
  "schedule": [
    {
      "code": "1",
      "name": "Nome do empreendimento",
      "level": 0,
      "startDayOffset": 0,
      "durationDays": duração total estimada em dias corridos,
      "weight": 1.0,
      "isCriticalPath": true,
      "activityTypeName": null,
      "children": [
        {
          "code": "1.1",
          "name": "Fase principal (ex: Infraestrutura e Fundações)",
          "level": 1,
          "startDayOffset": dias corridos após o início do projeto quando esta fase começa,
          "durationDays": dias corridos de duração desta fase,
          "weight": peso entre 0.05 e 0.50,
          "isCriticalPath": true ou false,
          "activityTypeName": null,
          "children": [
            {
              "code": "1.1.1",
              "name": "Sub-atividade específica",
              "level": 2,
              "startDayOffset": dias corridos após início do projeto quando esta sub-atividade começa,
              "durationDays": duração em dias,
              "weight": peso entre 0.01 e 0.15,
              "isCriticalPath": true ou false,
              "activityTypeName": "nome exato de um dos activityTypes listados acima, ou null"
            }
          ]
        }
      ]
    }
  ],
  "rawAnalysis": "resumo em português do que foi identificado no documento",
  "confidence": "high" | "medium" | "low"
}

Regras CRÍTICAS para o cronograma:
1. USE startDayOffset SEMPRE — representa quantos dias corridos após o início do projeto cada item começa.
2. ATIVIDADES PARALELAS são normais em obras: alvenaria, hidráulica e elétrica podem ter startDayOffset próximos ou sobrepostos.
3. Use a lógica de obra real: fundações terminam antes da estrutura; estrutura sobrepõe com alvenaria; instalações sobrepõem com alvenaria; acabamentos após instalações.
4. activityTypes deve ter entre 6 e 12 atividades com nomes que serão usados em medições por unidade.
5. schedule deve ter 3 níveis (EAP): nível 0 = raiz do projeto, nível 1 = fases principais (4-6 fases), nível 2 = sub-atividades mensuráveis (2-4 por fase).
6. A soma dos weights dos filhos diretos de nível 1 deve ser aproximadamente 1.0.
7. activityTypeName em nível 2 deve referenciar EXATAMENTE um dos nomes em activityTypes, ou null para itens não mensuráveis por unidade.
8. Atividades típicas para obras residenciais: Terraplanagem, Fundações, Estrutura de Concreto, Alvenaria, Instalações Hidráulicas, Instalações Elétricas, Revestimento Interno, Revestimento de Piso, Pintura, Esquadrias, Acabamentos.
9. Se o documento não tiver informações claras, use valores típicos para obras residenciais brasileiras.
10. confidence = "high" se encontrou plantas claras, "medium" se parcial, "low" se inferido.

Exemplo de startDayOffset correto para obra de 24 meses (~720 dias):
- Terraplanagem: startDayOffset=0, durationDays=14
- Fundações: startDayOffset=10, durationDays=60 (começa antes da terraplanagem terminar)
- Estrutura: startDayOffset=60, durationDays=240
- Alvenaria: startDayOffset=120, durationDays=200 (paralela com estrutura após 2 meses)
- Instalações: startDayOffset=150, durationDays=300 (paralela com alvenaria)
- Acabamentos: startDayOffset=420, durationDays=180`;
let AiImportService = class AiImportService {
    constructor(config) {
        this.config = config;
        this.mistral = null;
        const apiKey = this.config.get('mistral.apiKey');
        this.modelName = this.config.get('mistral.model') || 'mistral-small-latest';
        if (apiKey) {
            this.mistral = new mistralai_1.Mistral({ apiKey });
        }
    }
    async analyzePdf(fileBuffer, _mimeType) {
        if (!this.mistral) {
            throw new common_1.BadRequestException('MISTRAL_API_KEY não configurada. Configure a variável de ambiente e reinicie o servidor.');
        }
        let rawText;
        let uploadedFileId = null;
        try {
            const uploaded = await this.mistral.files.upload({
                file: {
                    fileName: 'plantas.pdf',
                    content: fileBuffer,
                },
                purpose: 'ocr',
            });
            uploadedFileId = uploaded.id;
            const signed = await this.mistral.files.getSignedUrl({ fileId: uploaded.id, expiry: 1 });
            const chat = await this.mistral.chat.complete({
                model: this.modelName,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'document_url', documentUrl: signed.url },
                            { type: 'text', text: CONSTRUCTION_PROMPT },
                        ],
                    },
                ],
            });
            const content = chat.choices?.[0]?.message?.content;
            rawText = typeof content === 'string'
                ? content
                : Array.isArray(content)
                    ? content.map((c) => c?.text || '').join('')
                    : '';
        }
        catch (err) {
            const status = err?.statusCode ?? err?.status ?? err?.response?.status;
            console.error('[AiImport] Mistral error:', JSON.stringify({
                status,
                message: err?.message,
                body: err?.body,
            }));
            if (status === 429) {
                throw new common_1.BadRequestException(`Mistral 429: ${err?.message || 'rate limit'}`);
            }
            if (status === 401 || status === 403) {
                throw new common_1.BadRequestException('MISTRAL_API_KEY inválida. Verifique a chave em console.mistral.ai.');
            }
            throw new common_1.InternalServerErrorException(`Erro ao chamar API Mistral: ${err?.message || 'erro desconhecido'}`);
        }
        finally {
            if (uploadedFileId && this.mistral) {
                this.mistral.files.delete({ fileId: uploadedFileId }).catch(() => { });
            }
        }
        return this.parseAiResponse(rawText);
    }
    parseAiResponse(rawText) {
        let jsonStr = rawText.trim();
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
        }
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        }
        catch {
            return this.buildFallback(rawText);
        }
        if (!parsed.projectInfo)
            parsed.projectInfo = { towers: 1, floorsPerTower: 8, unitsPerFloor: 4 };
        if (!parsed.activityTypes?.length)
            parsed.activityTypes = this.defaultActivityTypes();
        if (!parsed.schedule?.length)
            parsed.schedule = this.buildDefaultSchedule(parsed.projectInfo?.name || 'Empreendimento');
        if (!parsed.rawAnalysis)
            parsed.rawAnalysis = 'Análise concluída.';
        if (!parsed.confidence)
            parsed.confidence = 'low';
        parsed.projectInfo.towers = Math.max(1, parsed.projectInfo.towers || 1);
        parsed.projectInfo.floorsPerTower = Math.max(1, parsed.projectInfo.floorsPerTower || 8);
        parsed.projectInfo.unitsPerFloor = Math.max(1, parsed.projectInfo.unitsPerFloor || 4);
        return parsed;
    }
    buildFallback(rawText) {
        return {
            projectInfo: { towers: 1, floorsPerTower: 8, unitsPerFloor: 4 },
            activityTypes: this.defaultActivityTypes(),
            schedule: this.buildDefaultSchedule('Empreendimento'),
            rawAnalysis: rawText.slice(0, 500),
            confidence: 'low',
        };
    }
    defaultActivityTypes() {
        return [
            { name: 'Terraplanagem e Fundações', unit: 'm³', measurementMethod: 'METRIC', weight: 1.5 },
            { name: 'Estrutura de Concreto', unit: 'm³', measurementMethod: 'METRIC', weight: 2.0 },
            { name: 'Alvenaria', unit: 'm²', measurementMethod: 'METRIC', weight: 1.5 },
            { name: 'Instalação Hidráulica', unit: '%', measurementMethod: 'PERCENT', weight: 1.3 },
            { name: 'Instalação Elétrica', unit: '%', measurementMethod: 'PERCENT', weight: 1.3 },
            { name: 'Revestimento Interno', unit: 'm²', measurementMethod: 'METRIC', weight: 1.2 },
            { name: 'Revestimento de Piso', unit: 'm²', measurementMethod: 'METRIC', weight: 1.1 },
            { name: 'Pintura', unit: '%', measurementMethod: 'PERCENT', weight: 0.9 },
            { name: 'Esquadrias', unit: 'un', measurementMethod: 'COUNT', weight: 1.0 },
            { name: 'Acabamentos', unit: '%', measurementMethod: 'PERCENT', weight: 0.8 },
        ];
    }
    buildDefaultSchedule(projectName) {
        return [
            {
                code: '1', name: projectName, level: 0,
                startDayOffset: 0, durationDays: 720, weight: 1.0, isCriticalPath: true, activityTypeName: null,
                children: [
                    {
                        code: '1.1', name: 'Infraestrutura e Fundações', level: 1,
                        startDayOffset: 0, durationDays: 90, weight: 0.12, isCriticalPath: true, activityTypeName: null,
                        children: [
                            { code: '1.1.1', name: 'Terraplanagem e Locação', level: 2, startDayOffset: 0, durationDays: 14, weight: 0.02, isCriticalPath: true, activityTypeName: 'Terraplanagem e Fundações' },
                            { code: '1.1.2', name: 'Estacas e Fundações', level: 2, startDayOffset: 10, durationDays: 45, weight: 0.06, isCriticalPath: true, activityTypeName: 'Terraplanagem e Fundações' },
                            { code: '1.1.3', name: 'Vigas Baldrame e Laje', level: 2, startDayOffset: 50, durationDays: 30, weight: 0.04, isCriticalPath: true, activityTypeName: 'Estrutura de Concreto' },
                        ],
                    },
                    {
                        code: '1.2', name: 'Estrutura', level: 1,
                        startDayOffset: 60, durationDays: 240, weight: 0.30, isCriticalPath: true, activityTypeName: null,
                        children: [
                            { code: '1.2.1', name: 'Estrutura Térreo', level: 2, startDayOffset: 60, durationDays: 30, weight: 0.04, isCriticalPath: true, activityTypeName: 'Estrutura de Concreto' },
                            { code: '1.2.2', name: 'Estrutura Pavimentos Tipo', level: 2, startDayOffset: 85, durationDays: 180, weight: 0.20, isCriticalPath: true, activityTypeName: 'Estrutura de Concreto' },
                            { code: '1.2.3', name: 'Estrutura Cobertura', level: 2, startDayOffset: 260, durationDays: 30, weight: 0.06, isCriticalPath: true, activityTypeName: 'Estrutura de Concreto' },
                        ],
                    },
                    {
                        code: '1.3', name: 'Vedações e Instalações', level: 1,
                        startDayOffset: 120, durationDays: 330, weight: 0.35, isCriticalPath: false, activityTypeName: null,
                        children: [
                            { code: '1.3.1', name: 'Alvenaria', level: 2, startDayOffset: 120, durationDays: 180, weight: 0.12, isCriticalPath: false, activityTypeName: 'Alvenaria' },
                            { code: '1.3.2', name: 'Instalações Hidráulicas', level: 2, startDayOffset: 150, durationDays: 200, weight: 0.10, isCriticalPath: false, activityTypeName: 'Instalação Hidráulica' },
                            { code: '1.3.3', name: 'Instalações Elétricas', level: 2, startDayOffset: 150, durationDays: 200, weight: 0.10, isCriticalPath: false, activityTypeName: 'Instalação Elétrica' },
                            { code: '1.3.4', name: 'Revestimentos Internos', level: 2, startDayOffset: 300, durationDays: 150, weight: 0.03, isCriticalPath: false, activityTypeName: 'Revestimento Interno' },
                        ],
                    },
                    {
                        code: '1.4', name: 'Acabamentos', level: 1,
                        startDayOffset: 420, durationDays: 200, weight: 0.19, isCriticalPath: false, activityTypeName: null,
                        children: [
                            { code: '1.4.1', name: 'Revestimento de Piso', level: 2, startDayOffset: 420, durationDays: 120, weight: 0.07, isCriticalPath: false, activityTypeName: 'Revestimento de Piso' },
                            { code: '1.4.2', name: 'Pintura', level: 2, startDayOffset: 480, durationDays: 90, weight: 0.06, isCriticalPath: false, activityTypeName: 'Pintura' },
                            { code: '1.4.3', name: 'Esquadrias e Acabamentos', level: 2, startDayOffset: 510, durationDays: 80, weight: 0.06, isCriticalPath: false, activityTypeName: 'Acabamentos' },
                        ],
                    },
                    {
                        code: '1.5', name: 'Obras Externas e Entrega', level: 1,
                        startDayOffset: 600, durationDays: 120, weight: 0.04, isCriticalPath: false, activityTypeName: null,
                        children: [
                            { code: '1.5.1', name: 'Pavimentação e Estacionamento', level: 2, startDayOffset: 600, durationDays: 60, weight: 0.02, isCriticalPath: false, activityTypeName: null },
                            { code: '1.5.2', name: 'Paisagismo e Área de Lazer', level: 2, startDayOffset: 630, durationDays: 60, weight: 0.02, isCriticalPath: false, activityTypeName: null },
                        ],
                    },
                ],
            },
        ];
    }
};
exports.AiImportService = AiImportService;
exports.AiImportService = AiImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiImportService);
//# sourceMappingURL=ai-import.service.js.map