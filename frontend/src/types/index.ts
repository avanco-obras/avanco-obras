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
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  estimatedCost?: number;
  currency: string;
  totalArea?: number;
  workdaysPerWeek: number;
  hoursPerDay: number;
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
  actualProgress: number;
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
  actualProgress: number;
  isCriticalPath: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  parentId?: string;
  durationDays?: number;
  weight?: number;
  responsible?: string;
  rowId?: number;
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

// Weekly Planning types
export type TaskStatus = 'COMPLETED' | 'NOT_COMPLETED' | 'PARTIALLY';
export type RestrictionStatus = 'PENDING' | 'IN_ANALYSIS' | 'RELEASED' | 'EXPIRED';

export interface WeeklyPlan {
  id: string;
  projectId: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  ppcTarget: number;
  ppcActual?: number;
  ppcForecast?: number;
  notes?: string;
  createdAt: string;
  tasks?: WeeklyTask[];
  restrictions?: Restriction[];
}

export interface WeeklyTask {
  id: string;
  weeklyPlanId: string;
  assignedToId?: string;
  description: string;
  location: string;
  status: TaskStatus;
  nonCompletionCause?: string;
  createdAt: string;
  assignedTo?: User;
}

export interface Restriction {
  id: string;
  weeklyPlanId: string;
  description: string;
  responsible: string;
  dueDate: string;
  status: RestrictionStatus;
  resolvedAt?: string;
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
  actualProgress: number;
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
      actualProgress: number;
    };
    current?: {
      startDate: string;
      endDate: string;
      durationDays: number;
      actualProgress: number;
    };
  }>;
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
