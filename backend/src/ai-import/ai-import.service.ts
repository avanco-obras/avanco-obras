import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { AiImportResultDto, AiScheduleItem } from './dto/ai-import-result.dto';

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
      "durationDays": duração total estimada,
      "weight": 1.0,
      "isCriticalPath": true,
      "children": [
        {
          "code": "1.1",
          "name": "Fase ou etapa",
          "level": 1,
          "durationDays": dias estimados,
          "weight": peso entre 0.05 e 0.50,
          "isCriticalPath": true ou false,
          "children": []
        }
      ]
    }
  ],
  "rawAnalysis": "resumo em português do que foi identificado no documento",
  "confidence": "high" | "medium" | "low"
}

Regras importantes:
- activityTypes deve ter entre 6 e 12 atividades típicas para o tipo de obra identificado
- Atividades típicas para obras residenciais: Terraplanagem, Fundações, Estrutura de Concreto, Alvenaria, Instalações Hidráulicas, Instalações Elétricas, Revestimento Interno, Revestimento de Piso, Pintura, Esquadrias, Acabamentos
- schedule deve ter 3 níveis hierárquicos (EAP): nível 0 = raiz, nível 1 = fases principais, nível 2 = sub-atividades
- A soma dos weights dos filhos de nível 1 deve ser aproximadamente 1.0
- Se o documento não tiver informações claras, use valores típicos para obras residenciais brasileiras
- confidence = "high" se encontrou plantas claras, "medium" se parcial, "low" se inferido`;

@Injectable()
export class AiImportService {
  private mistral: Mistral | null = null;
  private modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('mistral.apiKey');
    this.modelName = this.config.get<string>('mistral.model') || 'mistral-small-latest';
    if (apiKey) {
      this.mistral = new Mistral({ apiKey });
    }
  }

  async analyzePdf(fileBuffer: Buffer, _mimeType: string): Promise<AiImportResultDto> {
    if (!this.mistral) {
      throw new BadRequestException(
        'MISTRAL_API_KEY não configurada. Configure a variável de ambiente e reinicie o servidor.',
      );
    }

    let rawText: string;
    let uploadedFileId: string | null = null;

    try {
      // 1. Upload do PDF para o Mistral
      const uploaded = await this.mistral.files.upload({
        file: {
          fileName: 'plantas.pdf',
          content: fileBuffer,
        },
        purpose: 'ocr' as never,
      });
      uploadedFileId = uploaded.id;

      // 2. Obter URL assinada (válida por 1 hora)
      const signed = await this.mistral.files.getSignedUrl({ fileId: uploaded.id, expiry: 1 });

      // 3. Chamar chat completion com document_url
      const chat = await this.mistral.chat.complete({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document_url', documentUrl: signed.url } as never,
              { type: 'text', text: CONSTRUCTION_PROMPT },
            ] as never,
          },
        ],
      });

      const content = chat.choices?.[0]?.message?.content;
      rawText = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((c: any) => c?.text || '').join('')
          : '';
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status ?? err?.response?.status;
      console.error('[AiImport] Mistral error:', JSON.stringify({
        status,
        message: err?.message,
        body: err?.body,
      }));
      if (status === 429) {
        throw new BadRequestException(`Mistral 429: ${err?.message || 'rate limit'}`);
      }
      if (status === 401 || status === 403) {
        throw new BadRequestException('MISTRAL_API_KEY inválida. Verifique a chave em console.mistral.ai.');
      }
      throw new InternalServerErrorException(`Erro ao chamar API Mistral: ${err?.message || 'erro desconhecido'}`);
    } finally {
      // Limpa o arquivo do Mistral
      if (uploadedFileId && this.mistral) {
        this.mistral.files.delete({ fileId: uploadedFileId }).catch(() => {});
      }
    }

    return this.parseAiResponse(rawText);
  }

  private parseAiResponse(rawText: string): AiImportResultDto {
    let jsonStr = rawText.trim();

    // Remove markdown code fences se presentes
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    let parsed: AiImportResultDto;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.buildFallback(rawText);
    }

    if (!parsed.projectInfo) parsed.projectInfo = { towers: 1, floorsPerTower: 8, unitsPerFloor: 4 };
    if (!parsed.activityTypes?.length) parsed.activityTypes = this.defaultActivityTypes();
    if (!parsed.schedule?.length) parsed.schedule = this.buildDefaultSchedule(parsed.projectInfo?.name || 'Empreendimento');
    if (!parsed.rawAnalysis) parsed.rawAnalysis = 'Análise concluída.';
    if (!parsed.confidence) parsed.confidence = 'low';

    parsed.projectInfo.towers = Math.max(1, parsed.projectInfo.towers || 1);
    parsed.projectInfo.floorsPerTower = Math.max(1, parsed.projectInfo.floorsPerTower || 8);
    parsed.projectInfo.unitsPerFloor = Math.max(1, parsed.projectInfo.unitsPerFloor || 4);

    return parsed;
  }

  private buildFallback(rawText: string): AiImportResultDto {
    return {
      projectInfo: { towers: 1, floorsPerTower: 8, unitsPerFloor: 4 },
      activityTypes: this.defaultActivityTypes(),
      schedule: this.buildDefaultSchedule('Empreendimento'),
      rawAnalysis: rawText.slice(0, 500),
      confidence: 'low',
    };
  }

  private defaultActivityTypes() {
    return [
      { name: 'Terraplanagem e Fundações', unit: 'm³', measurementMethod: 'METRIC' as const, weight: 1.5 },
      { name: 'Estrutura de Concreto', unit: 'm³', measurementMethod: 'METRIC' as const, weight: 2.0 },
      { name: 'Alvenaria', unit: 'm²', measurementMethod: 'METRIC' as const, weight: 1.5 },
      { name: 'Instalação Hidráulica', unit: '%', measurementMethod: 'PERCENT' as const, weight: 1.3 },
      { name: 'Instalação Elétrica', unit: '%', measurementMethod: 'PERCENT' as const, weight: 1.3 },
      { name: 'Revestimento Interno', unit: 'm²', measurementMethod: 'METRIC' as const, weight: 1.2 },
      { name: 'Revestimento de Piso', unit: 'm²', measurementMethod: 'METRIC' as const, weight: 1.1 },
      { name: 'Pintura', unit: '%', measurementMethod: 'PERCENT' as const, weight: 0.9 },
      { name: 'Esquadrias', unit: 'un', measurementMethod: 'COUNT' as const, weight: 1.0 },
      { name: 'Acabamentos', unit: '%', measurementMethod: 'PERCENT' as const, weight: 0.8 },
    ];
  }

  private buildDefaultSchedule(projectName: string): AiScheduleItem[] {
    return [
      {
        code: '1',
        name: projectName,
        level: 0,
        durationDays: 720,
        weight: 1.0,
        isCriticalPath: true,
        children: [
          {
            code: '1.1',
            name: 'Infraestrutura e Fundações',
            level: 1,
            durationDays: 90,
            weight: 0.12,
            isCriticalPath: true,
            children: [
              { code: '1.1.1', name: 'Terraplanagem e Locação', level: 2, durationDays: 14, weight: 0.02, isCriticalPath: true },
              { code: '1.1.2', name: 'Estacas e Fundações', level: 2, durationDays: 45, weight: 0.06, isCriticalPath: true },
              { code: '1.1.3', name: 'Vigas Baldrame e Laje', level: 2, durationDays: 30, weight: 0.04, isCriticalPath: true },
            ],
          },
          {
            code: '1.2',
            name: 'Estrutura',
            level: 1,
            durationDays: 240,
            weight: 0.30,
            isCriticalPath: true,
            children: [
              { code: '1.2.1', name: 'Estrutura Térreo', level: 2, durationDays: 30, weight: 0.04, isCriticalPath: true },
              { code: '1.2.2', name: 'Estrutura Pavimentos Tipo', level: 2, durationDays: 180, weight: 0.20, isCriticalPath: true },
              { code: '1.2.3', name: 'Estrutura Cobertura', level: 2, durationDays: 30, weight: 0.06, isCriticalPath: true },
            ],
          },
          {
            code: '1.3',
            name: 'Vedações e Instalações',
            level: 1,
            durationDays: 300,
            weight: 0.35,
            isCriticalPath: false,
            children: [
              { code: '1.3.1', name: 'Alvenaria', level: 2, durationDays: 150, weight: 0.12, isCriticalPath: false },
              { code: '1.3.2', name: 'Instalações Hidráulicas', level: 2, durationDays: 200, weight: 0.10, isCriticalPath: false },
              { code: '1.3.3', name: 'Instalações Elétricas', level: 2, durationDays: 200, weight: 0.10, isCriticalPath: false },
              { code: '1.3.4', name: 'Revestimentos Internos', level: 2, durationDays: 180, weight: 0.03, isCriticalPath: false },
            ],
          },
          {
            code: '1.4',
            name: 'Acabamentos',
            level: 1,
            durationDays: 200,
            weight: 0.19,
            isCriticalPath: false,
            children: [
              { code: '1.4.1', name: 'Revestimento de Piso', level: 2, durationDays: 120, weight: 0.07, isCriticalPath: false },
              { code: '1.4.2', name: 'Pintura', level: 2, durationDays: 90, weight: 0.06, isCriticalPath: false },
              { code: '1.4.3', name: 'Esquadrias e Acabamentos', level: 2, durationDays: 60, weight: 0.06, isCriticalPath: false },
            ],
          },
          {
            code: '1.5',
            name: 'Obras Externas e Entrega',
            level: 1,
            durationDays: 90,
            weight: 0.04,
            isCriticalPath: false,
            children: [
              { code: '1.5.1', name: 'Pavimentação e Estacionamento', level: 2, durationDays: 45, weight: 0.02, isCriticalPath: false },
              { code: '1.5.2', name: 'Paisagismo e Área de Lazer', level: 2, durationDays: 60, weight: 0.02, isCriticalPath: false },
            ],
          },
        ],
      },
    ];
  }
}
