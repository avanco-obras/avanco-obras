import axios from 'axios';
import type {
  AuthResponse, User, Project, ProjectMember, Tower, Floor, Unit,
  ActivityType, ScheduleItem, GanttTask, CurvaSPoint, Measurement,
  WeeklyPlan, WeeklyTask, Restriction, DashboardKPIs, DelayedActivity,
  PPCHistoryPoint, BuildingData, Upload, ScheduleDependencyItem,
} from '../types';
import { useStore } from '../store';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: attach token
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('avanco-obras-storage');
  if (stored) {
    try {
      const { state } = JSON.parse(stored);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch {}
  }
  return config;
});

// Interceptor: unwrap data wrapper
api.interceptors.response.use(
  (res) => {
    if (res.data && 'data' in res.data && 'statusCode' in res.data) {
      return { ...res, data: res.data.data };
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
      if (!isLoginRequest) {
        useStore.getState().clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  register: (data: { email: string; username: string; fullName: string; password: string; role?: string; phone?: string; crea?: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

// ── Users ─────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<User[]>('/users').then((r) => r.data),
  update: (id: string, data: Partial<User>) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),
  changePassword: (id: string, data: { currentPassword: string; newPassword: string }) =>
    api.patch(`/users/${id}/password`, data).then((r) => r.data),
};

// ── Projects ─────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  create: (data: Partial<Project>) =>
    api.post<Project>('/projects', data).then((r) => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
  addMember: (id: string, data: { email: string; role: string }) =>
    api.post<ProjectMember>(`/projects/${id}/members`, data).then((r) => r.data),
};

// ── Towers / Floors / Units ───────────────────────────────────────
export const towersApi = {
  list: (projectId: string) =>
    api.get<Tower[]>(`/projects/${projectId}/towers`).then((r) => r.data),
  create: (projectId: string, data: { name: string; order?: number }) =>
    api.post<Tower>(`/projects/${projectId}/towers`, data).then((r) => r.data),
  listFloors: (projectId: string, towerId: string) =>
    api.get<Floor[]>(`/projects/${projectId}/towers/${towerId}/floors`).then((r) => r.data),
  createFloor: (projectId: string, towerId: string, data: { name: string; level: number; order?: number }) =>
    api.post<Floor>(`/projects/${projectId}/towers/${towerId}/floors`, data).then((r) => r.data),
  listUnits: (floorId: string) =>
    api.get<Unit[]>(`/floors/${floorId}/units`).then((r) => r.data),
  createUnit: (floorId: string, data: { name: string; area?: number; order?: number }) =>
    api.post<Unit>(`/floors/${floorId}/units`, data).then((r) => r.data),
};

// ── Activity Types ────────────────────────────────────────────────
export const activityTypesApi = {
  list: (projectId: string) =>
    api.get<ActivityType[]>(`/projects/${projectId}/activity-types`).then((r) => r.data),
  create: (projectId: string, data: Partial<ActivityType>) =>
    api.post<ActivityType>(`/projects/${projectId}/activity-types`, data).then((r) => r.data),
  update: (id: string, data: Partial<ActivityType>) =>
    api.patch<ActivityType>(`/activity-types/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/activity-types/${id}`).then((r) => r.data),
};

// ── Schedule ──────────────────────────────────────────────────────
export const scheduleApi = {
  list: (projectId: string) =>
    api.get<ScheduleItem[]>(`/projects/${projectId}/schedule`).then((r) => r.data),
  create: (projectId: string, data: Partial<ScheduleItem>) =>
    api.post<ScheduleItem>(`/projects/${projectId}/schedule`, data).then((r) => r.data),
  update: (id: string, data: Partial<ScheduleItem>) =>
    api.patch<ScheduleItem>(`/schedule/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/schedule/${id}`).then((r) => r.data),
  ganttData: (projectId: string) =>
    api.get<GanttTask[]>(`/projects/${projectId}/schedule/gantt-data`).then((r) => r.data),
  curvaS: (projectId: string) =>
    api.get<CurvaSPoint[]>(`/projects/${projectId}/schedule/curva-s`).then((r) => r.data),
  addDependency: (successorId: string, data: { predecessorId: string; lagDays?: number; type?: string }) =>
    api.post<ScheduleDependencyItem>(`/schedule/${successorId}/predecessors`, data).then((r) => r.data),
  removeDependency: (depId: string) =>
    api.delete(`/schedule/dependencies/${depId}`).then((r) => r.data),
  getDependencies: (itemId: string) =>
    api.get<ScheduleDependencyItem[]>(`/schedule/${itemId}/dependencies`).then((r) => r.data),
  import: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ imported: number; skipped: number; errors: string[] }>(
      `/projects/${projectId}/schedule/import`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data);
  },
};

// ── Measurements ──────────────────────────────────────────────────
export const measurementsApi = {
  list: (unitId: string) =>
    api.get<Measurement[]>(`/units/${unitId}/measurements`).then((r) => r.data),
  create: (unitId: string, data: Partial<Measurement>) =>
    api.post<Measurement>(`/units/${unitId}/measurements`, data).then((r) => r.data),
  update: (id: string, data: Partial<Measurement>) =>
    api.patch<Measurement>(`/measurements/${id}`, data).then((r) => r.data),
  batch: (unitId: string, data: unknown[]) =>
    api.post(`/units/${unitId}/measurements/batch`, { measurements: data }).then((r) => r.data),
  summary: (projectId: string) =>
    api.get(`/projects/${projectId}/measurements/summary`).then((r) => r.data),
  buildingData: (projectId: string) =>
    api.get<BuildingData>(`/projects/${projectId}/measurements/building-data`).then((r) => r.data),
};

// ── Weekly Planning ───────────────────────────────────────────────
export const weeklyPlanningApi = {
  list: (projectId: string) =>
    api.get<WeeklyPlan[]>(`/projects/${projectId}/weekly-plans`).then((r) => r.data),
  create: (projectId: string, data: Partial<WeeklyPlan>) =>
    api.post<WeeklyPlan>(`/projects/${projectId}/weekly-plans`, data).then((r) => r.data),
  get: (id: string) =>
    api.get<WeeklyPlan>(`/weekly-plans/${id}`).then((r) => r.data),
  addTask: (id: string, data: Partial<WeeklyTask>) =>
    api.post<WeeklyTask>(`/weekly-plans/${id}/tasks`, data).then((r) => r.data),
  updateTask: (taskId: string, data: Partial<WeeklyTask>) =>
    api.patch<WeeklyTask>(`/weekly-tasks/${taskId}`, data).then((r) => r.data),
  addRestriction: (id: string, data: Partial<Restriction>) =>
    api.post<Restriction>(`/weekly-plans/${id}/restrictions`, data).then((r) => r.data),
  updateRestriction: (id: string, data: Partial<Restriction>) =>
    api.patch<Restriction>(`/restrictions/${id}`, data).then((r) => r.data),
  ppcHistory: (projectId: string) =>
    api.get<PPCHistoryPoint[]>(`/projects/${projectId}/weekly-plans/ppc-history`).then((r) => r.data),
  generate: (id: string) =>
    api.post(`/weekly-plans/${id}/generate`).then((r) => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: (projectId: string) =>
    api.get<DashboardKPIs>(`/projects/${projectId}/dashboard`).then((r) => r.data),
  delays: (projectId: string) =>
    api.get<DelayedActivity[]>(`/projects/${projectId}/dashboard/delays`).then((r) => r.data),
  restrictions: (projectId: string) =>
    api.get<Restriction[]>(`/projects/${projectId}/dashboard/restrictions`).then((r) => r.data),
  spiHistory: (projectId: string) =>
    api.get(`/projects/${projectId}/dashboard/spi`).then((r) => r.data),
};

// ── Uploads ───────────────────────────────────────────────────────
export const uploadsApi = {
  list: (projectId: string) =>
    api.get<Upload[]>(`/projects/${projectId}/uploads`).then((r) => r.data),
  upload: (projectId: string, formData: FormData) =>
    api.post<Upload>(`/projects/${projectId}/uploads`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  delete: (id: string) => api.delete(`/uploads/${id}`).then((r) => r.data),
};

// ── AI Import ─────────────────────────────────────────────────────
export const aiImportApi = {
  analyzePdf: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/ai-import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min — Gemini pode demorar em PDFs grandes
    }).then((r) => r.data);
  },
};

export default api;
