// User types
export type UserRole = 'ADMIN' | 'ENGINEER' | 'FOREMAN' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  crea?: string;
  avatarUrl?: string;
  isActive: boolean;
  notificationPreferences?: Record<string, boolean> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// Project types
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
export type ProgressCriteria = 'COST' | 'QUANTITY' | 'HYBRID';

export interface Project {
  id: string;
  name: string;
  company: string;
  address: string;
  engineer?: string;
  contact?: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  estimatedCost?: number;
  currency: string;
  totalArea?: number;
  workdaysPerWeek: number;
  hoursPerDay: number;
  weekStartDay: number; // 0=Domingo … 6=Sábado
  timezone: string;
  progressCriteria: ProgressCriteria;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
  towers?: Tower[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: UserRole;
  addedAt: string;
  user?: User;
}

// Physical structure types
export interface Tower {
  id: string;
  projectId: string;
  name: string;
  order: number;
  floors?: Floor[];
}

export interface Floor {
  id: string;
  towerId: string;
  name: string;
  level: number;
  order: number;
  units?: Unit[];
}

export interface Unit {
  id: string;
  floorId: string;
  name: string;
  area?: number;
  order: number;
  measurements?: Measurement[];
  progressPercent?: number; // computed
}

// Activity types
export type MeasurementMethod = 'PERCENT' | 'METRIC' | 'COUNT';

export interface ActivityType {
  id: string;
  projectId: string;
  name: string;
  measurementMethod: MeasurementMethod;
  unit: string;
  defaultQuantity: number;
  weight: number;
  order: number;
}

// Schedule types
export interface ScheduleItem {
  id: string;
  projectId: string;
  parentId?: string;
  activityTypeId?: string;
  code: string;
  name: string;
  level: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  plannedProgress: number;
  physicalProgress: number;
  weight: number;
  isCriticalPath: boolean;
  responsible?: string;
  order: number;
  children?: ScheduleItem[];
  activityType?: ActivityType;
}

export interface GanttTask {
  id: string;
  code: string;
  name: string;
  level: number;
  startDate: string;
  endDate: string;
  plannedProgress: number;
  physicalProgress: number;
  isCriticalPath: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentId?: string;
  durationDays?: number;
  weight?: number;
  responsible?: string;
  rowId?: number;
  activityTypeId?: string;
  activityTypeName?: string;
  predecessorDeps?: TaskDep[];
  successorDeps?: TaskDep[];
}

export interface ScheduleDependencyItem {
  id: string;
  predecessorId: string;
  successorId: string;
  lagDays: number;
  type: string;
  predecessor?: { id: string; code: string; name: string };
  successor?: { id: string; code: string; name: string };
}

export interface TaskDep {
  id: string;
  predecessorId: string;
  successorId: string;
  lagDays: number;
  type: string;
}

export interface CurvaSPoint {
  label: string;  // period label e.g. "Jan/25"
  planned: number;  // cumulative planned %
  actual: number;   // cumulative actual %
  date: string;
}

// Measurement types
export interface Measurement {
  id: string;
  unitId: string;
  activityTypeId: string;
  measuredById: string;
  date: string;
  percentComplete: number;
  executedQty?: number;
  totalQty?: number;
  notes?: string;
  photoUrl?: string;
  createdAt: string;
  activityType?: ActivityType;
  measuredBy?: User;
}

export interface MeasurementInput {
  activityTypeId: string;
  percentComplete?: number;
  executedQty?: number;
  totalQty?: number;
  notes?: string;
  method: MeasurementMethod;
}

export interface BuildingData {
  towers: {
    id: string;
    name: string;
    floors: {
      id: string;
      name: string;
      level: number;
      units: {
        id: string;
        name: string;
        progressPercent: number;
      }[];
      averageProgress: number;
    }[];
  }[];
}

// Programação Semanal (v2)
export type WeeklyProgramStatus = 'RASCUNHO' | 'PUBLICADA' | 'FECHADA';
export type WeeklyActivityStatus =
  | 'PROGRAMADA'
  | 'NAO_INICIADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'REPROGRAMADA';
export type WeeklyActivityOrigin = 'CRONOGRAMA' | 'MANUAL' | 'REPROGRAMADA';
export type WeeklyRestrictionStatus = 'PENDENTE' | 'RESOLVIDA';
export type WeeklySnapshotKind = 'PUBLICACAO' | 'REPORT' | 'FECHAMENTO';

export interface Contractor {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestrictionType {
  id: string;
  projectId: string;
  name: string;
  order: number;
  isActive: boolean;
}

export interface WeeklyIndicators {
  ppc: number;
  totalActivities: number;
  validActivities: number;
  completed: number;
  cancelled: number;
  carriedOver: number;
  reprogrammedPct: number;
  restrictionsCount: number;
  restrictionsPending: number;
  topCauses: Array<{ type: string; count: number }>;
  byContractor: Array<{
    contractorId: string | null;
    name: string;
    total: number;
    completed: number;
    ppc: number;
    reprogrammedPct: number;
  }>;
  byResponsible: Array<{ responsible: string; planned: number; delivered: number; ppc: number }>;
}

export interface WeeklyProgram {
  id: string;
  projectId: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  meetingDate: string;
  status: WeeklyProgramStatus;
  publishedAt?: string | null;
  closedAt?: string | null;
  indicators?: WeeklyIndicators | null;
  createdAt: string;
  updatedAt: string;
  activities?: WeeklyActivity[];
  restrictions?: WeeklyRestriction[];
  _count?: { activities: number; restrictions: number };
}

export interface WeeklyActivity {
  id: string;
  programId: string;
  scheduleItemId?: string | null;
  origin: WeeklyActivityOrigin;
  local: string;
  torre: string;
  pavimento: string;
  activityName: string;
  contractorId?: string | null;
  responsible?: string | null;
  status: WeeklyActivityStatus;
  percentExecuted: number;
  carryoverFromId?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  contractor?: Pick<Contractor, 'id' | 'name' | 'isActive'> | null;
  restrictionLinks?: Array<{ restrictionId: string }>;
}

export interface WeeklyRestriction {
  id: string;
  programId: string;
  typeId?: string | null;
  description: string;
  responsible: string;
  dueDate?: string | null;
  resolvedAt?: string | null;
  status: WeeklyRestrictionStatus;
  impactsProgram: boolean;
  createdAt: string;
  updatedAt: string;
  type?: Pick<RestrictionType, 'id' | 'name'> | null;
  activityLinks?: Array<{ activityId: string }>;
}

export interface WeeklySnapshotMeta {
  id: string;
  kind: WeeklySnapshotKind;
  createdAt: string;
  createdBy: { id: string; fullName: string };
}

export interface WeeklySnapshot extends WeeklySnapshotMeta {
  programId: string;
  payload: {
    program: WeeklyProgram;
    indicators: WeeklyIndicators;
  };
}

// Dashboard types
export interface DashboardKPIs {
  physicalProgress: number;
  spi: number;
  ppcCurrent?: number;
  ppcForecast?: number;
  plannedProgress: number;
  delayDays: number;
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
}

export interface DelayedActivity {
  id: string;
  code: string;
  name: string;
  plannedProgress: number;
  physicalProgress: number;
  deviation: number;
  delayDays: number;
  criticality: number; // 0-1
}

export interface PPCHistoryPoint {
  weekLabel: string;
  weekNumber: number;
  year: number;
  ppcActual: number;
  ppcTarget: number;
}

// Upload types
export interface Upload {
  id: string;
  projectId: string;
  fileName: string;
  fileType: string;
  category: string;
  storageKey: string;
  fileSize: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Baseline types
export interface ProjectBaseline {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
  };
  description?: string;
  itemCount: number;
  dependencyCount: number;
}

export interface BaselineComparison {
  baselineVersion: number;
  baselineDate: string;
  summary: {
    totalItems: number;
    itemsChanged: number;
    datesChanged: number;
    durationChanged: number;
    progressChanged: number;
  };
  changes: Array<{
    itemId: string;
    code: string;
    name: string;
    changeType: 'NEW_ITEM' | 'MODIFIED' | 'DELETED_ITEM';
    changes?: string[];
    baseline?: {
      startDate: string;
      endDate: string;
      durationDays: number;
      physicalProgress: number;
    };
    current?: {
      startDate: string;
      endDate: string;
      durationDays: number;
      physicalProgress: number;
    };
  }>;
}

// Linha de Balanço — histórico de reprogramações
export interface ScheduleRevisionChange {
  itemId: string;
  code: string;
  name: string;
  before: { startDate: string; endDate: string; durationDays: number };
  after: { startDate: string; endDate: string; durationDays: number };
}

export interface ScheduleRevision {
  id: string;
  projectId: string;
  userId: string;
  createdAt: string;
  description?: string | null;
  changes: ScheduleRevisionChange[];
  user?: { id: string; fullName: string; username: string };
}

// Physical Progress types
export interface ProjectReport {
  id: string;
  projectId: string;
  reportNumber: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
  };
  physicalProgress: number;
  baselineVersion: number;
  description?: string;
  itemCount?: number;
  /** 1 = só cronograma; 2 = cronograma + dependências + medições. */
  snapshotVersion?: number;
  /** Falso em reports antigos: a restauração devolve apenas o cronograma. */
  restoresFully?: boolean;
}

export interface RestoreReportResult {
  /** Número do report cujo estado foi restaurado. */
  restoredFrom: number;
  /** Report gravado com o estado anterior, para desfazer a restauração. */
  safetyReportNumber: number;
  /** Report de fechamento — é ele que passa a alimentar o indicador do topo. */
  restoredReportNumber: number;
  /** % consolidado após a restauração; igual ao da versão restaurada. */
  physicalProgress: number;
  partial: boolean;
  itemCount: number;
}

export interface ProjectMetrics {
  physicalProgress: number;
  lastReportDate: string | null;
  lastReportNumber: number;
  activeBaselineVersion: number;
  totalTasks: number;
  completedTasks: number;
}

export interface ReportComparison {
  reportNumber: number;
  reportDate: string;
  physicalProgress: number;
  baselineVersion: number;
  summary: {
    onSchedule: number;
    delayed: number;
    advanced: number;
    progressAbove: number;
    progressBelow: number;
  };
  changes: Array<{
    itemId: string;
    code: string;
    name: string;
    status: 'onSchedule' | 'delayed' | 'advanced';
    baseline: {
      endDate: string;
      progress: number;
    };
    report: {
      endDate: string;
      progress: number;
    };
    deviation: {
      days: number;
      progressDelta: number;
    };
  }>;
}
