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
  startDayOffset?: number;
  durationDays: number;
  weight: number;
  isCriticalPath: boolean;
  activityTypeName?: string | null;
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
