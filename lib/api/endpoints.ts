import { api } from './client';
import type {
  AlternativeExercise,
  Exercise,
  HistoryEntry,
  LoginResponse,
  MuscleGroup,
  PaginatedExercises,
  PatchExercisePayload,
  ProgressSummary,
  Role,
  TodayResponse,
  Workout,
  WorkoutDetail,
  WorkoutLog,
} from '../types';

export const authApi = {
  login: (role: Role, pin: string) =>
    api.post<LoginResponse>('/auth/login', { role, pin }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
};

export const exercisesApi = {
  list: (params: { muscleGroup?: string; search?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.muscleGroup) q.set('muscleGroup', params.muscleGroup);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    const qs = q.toString();
    return api.get<PaginatedExercises>(`/exercises${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<Exercise>(`/exercises/${id}`),
  alternatives: (id: string) =>
    api.get<AlternativeExercise[]>(`/exercises/${id}/alternatives`),
};

export const muscleGroupsApi = {
  list: () => api.get<MuscleGroup[]>('/muscle-groups'),
};

export const workoutsApi = {
  list: () => api.get<Workout[]>('/workouts'),
  get: (id: string) => api.get<WorkoutDetail>(`/workouts/${id}`),
  today: (dayOfWeek?: number) =>
    api.get<TodayResponse>(
      `/workouts/today${dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : ''}`,
    ),
  create: (data: { name: string; dayOfWeek?: number; active?: boolean }) =>
    api.post<Workout>('/workouts', data),
  addExercise: (
    workoutId: string,
    data: {
      exerciseId: string;
      order: number;
      sets: number;
      reps: string;
      restSeconds?: number;
      notes?: string;
    },
  ) => api.post(`/workouts/${workoutId}/exercises`, data),
};

export const workoutLogsApi = {
  open: (workoutId: string) =>
    api.post<WorkoutLog>('/workout-logs', { workoutId }),
  patchExercise: (
    logId: string,
    weId: string,
    payload: PatchExercisePayload,
  ) => api.patch(`/workout-logs/${logId}/exercises/${weId}`, payload),
  complete: (logId: string) =>
    api.patch<WorkoutLog>(`/workout-logs/${logId}/complete`),
  history: () => api.get<HistoryEntry[]>('/workout-logs/history'),
  myHistory: () => api.get<HistoryEntry[]>('/workout-logs/my-history'),
  progress: () => api.get<ProgressSummary>('/workout-logs/progress-summary'),
};
