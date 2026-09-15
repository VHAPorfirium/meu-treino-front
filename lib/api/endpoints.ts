import { api } from './client';
import type {
  AddExerciseBatchItem,
  AlternativeExercise,
  ExerciseMode,
  Exercise,
  HistoryEntry,
  LoginResponse,
  MuscleGroup,
  PaginatedExercises,
  PatchExercisePayload,
  ProgressPhoto,
  ProgressSummary,
  TodayResponse,
  TrainerNote,
  UserSummary,
  Workout,
  WorkoutDetail,
  WorkoutLog,
} from '../types';

export const authApi = {
  // Login por PIN: o backend identifica o usuário e devolve o papel dele.
  login: (pin: string) => api.post<LoginResponse>('/auth/login', { pin }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
};

export const usersApi = {
  // ADMIN — fonte do select "pra quem é o treino"
  list: (params: { role?: 'ADMIN' | 'TRAINEE' } = {}) =>
    api.get<UserSummary[]>(`/users${params.role ? `?role=${params.role}` : ''}`),
};

export const exercisesApi = {
  list: (
    params: {
      muscleGroup?: string;
      equipment?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.muscleGroup) q.set('muscleGroup', params.muscleGroup);
    if (params.equipment) q.set('equipment', params.equipment);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return api.get<PaginatedExercises>(`/exercises${qs ? `?${qs}` : ''}`);
  },
  /** equipamentos distintos do catálogo (alimenta o filtro) */
  equipment: () => api.get<string[]>('/exercises/equipment'),
  get: (id: string) => api.get<Exercise>(`/exercises/${id}`),
  alternatives: (id: string) =>
    api.get<AlternativeExercise[]>(`/exercises/${id}/alternatives`),
};

export const muscleGroupsApi = {
  list: () => api.get<MuscleGroup[]>('/muscle-groups'),
};

export const workoutsApi = {
  // leitura da aluna
  today: (dayOfWeek?: number) =>
    api.get<TodayResponse>(
      `/workouts/today${dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : ''}`,
    ),
  mine: () => api.get<Workout[]>('/workouts/mine'),

  // gestão (admin)
  list: () => api.get<Workout[]>('/workouts'),
  get: (id: string) => api.get<WorkoutDetail>(`/workouts/${id}`),
  create: (data: { name: string; dayOfWeek?: number; active?: boolean }) =>
    api.post<Workout>('/workouts', data),
  update: (
    id: string,
    data: { name?: string; dayOfWeek?: number | null; active?: boolean },
  ) => api.patch<Workout>(`/workouts/${id}`, data),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/workouts/${id}`),
  duplicate: (id: string, data: { name?: string; copyAssignees?: boolean } = {}) =>
    api.post<Workout>(`/workouts/${id}/duplicate`, data),
  setAssignees: (id: string, userIds: string[]) =>
    api.put<{ assignees: { id: string; name: string }[] }>(
      `/workouts/${id}/assignees`,
      { userIds },
    ),

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
  /** E7 — N exercícios numa transação; `order` é atribuído pelo servidor. */
  addExercisesBatch: (workoutId: string, items: AddExerciseBatchItem[]) =>
    api.post<{ id: string; order: number }[]>(
      `/workouts/${workoutId}/exercises/batch`,
      { items },
    ),
  updateExercise: (
    workoutId: string,
    weId: string,
    data: {
      mode?: ExerciseMode;
      sets?: number;
      reps?: string | null;
      durationSeconds?: number | null;
      restSeconds?: number | null;
      notes?: string | null;
    },
  ) => api.patch(`/workouts/${workoutId}/exercises/${weId}`, data),
  removeExercise: (workoutId: string, weId: string) =>
    api.delete<{ ok: boolean }>(`/workouts/${workoutId}/exercises/${weId}`),
  reorder: (workoutId: string, items: { workoutExerciseId: string; order: number }[]) =>
    api.patch<{ ok: boolean }>(`/workouts/${workoutId}/exercises/reorder`, { items }),
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
  /** Sem `userId` = agregado de todos os alunos; com `userId` = só aquele aluno. */
  progress: (userId?: string) =>
    api.get<ProgressSummary>(
      `/workout-logs/progress-summary${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`,
    ),
};

// E6 — recados do personal
export const notesApi = {
  mine: () => api.get<{ items: TrainerNote[]; unread: number }>('/notes/mine'),
  markRead: (id: string) => api.patch<TrainerNote>(`/notes/${id}/read`),
  // admin
  send: (toId: string, text: string) => api.post<TrainerNote>('/notes', { toId, text }),
  forUser: (userId: string) => api.get<TrainerNote[]>(`/notes/user/${userId}`),
};

// E6 — fotos de progresso (upload direto pro Supabase com URL assinada)
export const photosApi = {
  requestUpload: (ext: string) =>
    api.post<{ path: string; uploadUrl: string; token: string }>(
      '/progress-photos/upload-url',
      { ext },
    ),
  register: (data: { path: string; note?: string; takenAt?: string }) =>
    api.post<ProgressPhoto>('/progress-photos', data),
  mine: () => api.get<ProgressPhoto[]>('/progress-photos'),
  ofUser: (userId: string) => api.get<ProgressPhoto[]>(`/progress-photos/user/${userId}`),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/progress-photos/${id}`),
};

// E6 — push
export const pushApi = {
  publicKey: () => api.get<{ publicKey: string | null; enabled: boolean }>('/push/public-key'),
  subscribe: (sub: PushSubscriptionJSON) => api.post<{ ok: boolean }>('/push/subscribe', sub),
  unsubscribe: (endpoint: string) => api.delete<{ ok: boolean }>('/push/subscribe', { endpoint }),
};
