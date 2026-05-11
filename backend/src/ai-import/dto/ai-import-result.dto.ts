export interface AiActivityType {
  name: string;
  unit: string;
  measurementMethod: 'PERCENT' | 'METRIC' | 'COUNT';
  weight: number;
}

export interface AiScheduleItem {
  code: string;
  name: string;
  level: number;
  durationDays: number;
  weight: number;
  isCriticalPath: boolean;
  children?: AiScheduleItem[];
}

export interface AiProjectInfo {
  name?: string;
  totalArea?: number;
  towers: number;
  floorsPerTower: number;
  unitsPerFloor: number;
  estimatedDurationMonths?: number;
  buildingType?: string;
}

export interface AiImportResultDto {
  projectInfo: AiProjectInfo;
  activityTypes: AiActivityType[];
  schedule: AiScheduleItem[];
  rawAnalysis: string;
  confidence: 'high' | 'medium' | 'low';
}
