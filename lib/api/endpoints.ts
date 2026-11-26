import { api } from './client';
import { TTL_CATALOGO, lembrar, limpar } from './cache-modulo';
import type {
  AttentionItem,
  ExerciseStats,
  LastPerformanceByWorkoutExerciseId,
  AddExerciseBatchItem,
  AlternativeExercise,
  AuthUser,
  CompletedWorkoutLog,
  CreateProgramPayload,
  CurrentProgram,
  EquipamentoOpcao,
  ExerciseMode,
  Exercise,
  HistoryEntry,
  LoginResponse,
  MuscleGroup,
  PaginatedExercises,
  PatchExercisePayload,
  ProgramAchievement,
  ProgressPhoto,
  ProgressSummary,
  TodayResponse,
  TrainerNote,
  TrainingProgram,
  UpdateProgramPayload,
  UserSummary,
  Workout,
  WorkoutDetail,
  WorkoutLog,
} from '../types';

const TTL_USUARIOS = 60 * 1000;

export const authApi = {
  // Login O(1) por CPF (ou apelido legado v1.0) + senha forte.
  login: (identifier: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { identifier, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean; mustChangePassword: boolean }>('/auth/change-password', {
      currentPassword,
      newPassword,
    }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<AuthUser>('/auth/me'),
};

export const usersApi = {
  // ADMIN — fonte do select "pra quem é o treino" e gestão cadastral (cacheado por 1 min)
  list: (params: { role?: 'ADMIN' | 'TRAINEE'; active?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.role) q.set('role', params.role);
    if (params.active !== undefined) q.set('active', String(params.active));
    const qs = q.toString();
    return lembrar(`users:${qs || 'all'}`, TTL_USUARIOS, () =>
      api.get<UserSummary[]>(`/users${qs ? `?${qs}` : ''}`),
    );
  },
  suggestUsername: (name: string) =>
    api.get<{ username: string }>(
      `/users/suggest-username?name=${encodeURIComponent(name)}`,
    ),
  /** ADMIN — cadastra aluno com CPF validado, senha forte e username único automático. */
  createTrainee: async (payload: {
    name: string;
    cpf: string;
    password: string;
    username?: string;
  }) => {
    const created = await api.post<UserSummary>('/users', payload);
    limpar('users:');
    return created;
  },
  update: async (
    id: string,
    payload: { name?: string; username?: string; cpf?: string },
  ) => {
    const updated = await api.patch<UserSummary>(`/users/${id}`, payload);
    limpar('users:');
    return updated;
  },
  setActive: async (id: string, active: boolean) => {
    const updated = await api.patch<UserSummary>(`/users/${id}/status`, { active });
    limpar('users:');
    return updated;
  },
  resetPassword: async (id: string, newPassword: string) => {
    const result = await api.post<{ ok: boolean; user: UserSummary }>(
      `/users/${id}/reset-password`,
      { newPassword },
    );
    limpar('users:');
    return result;
  },
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
  /**
   * Equipamentos distintos do catálogo (alimenta o filtro) — cacheado no módulo.
   * E11: `valor` (inglês) é o que vai no filtro, `rotulo` é o que aparece.
   */
  equipment: () =>
    lembrar('ex:equip', TTL_CATALOGO, () =>
      api.get<EquipamentoOpcao[]>('/exercises/equipment'),
    ),
  get: (id: string) => api.get<Exercise>(`/exercises/${id}`),
  favorites: () => api.get<Exercise[]>('/exercises/favorites'),
  favorite: (exerciseId: string) => api.put<{ favorite: boolean }>(`/exercises/${exerciseId}/favorite`),
  unfavorite: (exerciseId: string) => api.delete<{ favorite: boolean }>(`/exercises/${exerciseId}/favorite`),
  alternatives: (id: string) =>
    api.get<AlternativeExercise[]>(`/exercises/${id}/alternatives`),
};

export const muscleGroupsApi = {
  // cacheado no módulo: era refeito a cada montagem do ExerciseBrowser
  list: () =>
    lembrar('mg:list', TTL_CATALOGO, () => api.get<MuscleGroup[]>('/muscle-groups')),
};

export const workoutsApi = {
  // leitura da aluna
  today: (dayOfWeek?: number) =>
    api.get<TodayResponse>(
      `/workouts/today${dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : ''}`,
    ),
  mine: () => api.get<Workout[]>('/workouts/mine'),
  /** Treino escolhido pelo aluno + sessão do dia (mesmo formato do `today`). */
  session: (workoutId: string) => api.get<TodayResponse>(`/workouts/${workoutId}/session`),

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

function historyQueryString(opts?: { limit?: number; offset?: number }): string {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const workoutLogsApi = {
  open: (workoutId: string) =>
    api.post<WorkoutLog>('/workout-logs', { workoutId }),
  patchExercise: (
    logId: string,
    weId: string,
    payload: PatchExercisePayload,
  ) => api.patch(`/workout-logs/${logId}/exercises/${weId}`, payload),
  complete: (logId: string) =>
    api.patch<CompletedWorkoutLog>(`/workout-logs/${logId}/complete`),
  history: (opts?: { limit?: number; offset?: number }) =>
    api.get<HistoryEntry[]>(`/workout-logs/history${historyQueryString(opts)}`),
  historyPage: async (opts?: { limit?: number; offset?: number }) => {
    const { data, total } = await api.getWithTotal<HistoryEntry[]>(
      `/workout-logs/history${historyQueryString(opts)}`,
    );
    return { items: data, total };
  },
  lastPerformance: (workoutId: string) =>
    api.get<LastPerformanceByWorkoutExerciseId>(
      `/workout-logs/last-performance?workoutId=${encodeURIComponent(workoutId)}`,
    ),
  exerciseStats: (exerciseId: string) =>
    api.get<ExerciseStats>(`/workout-logs/exercise-stats/${exerciseId}`),
  attention: () => api.get<AttentionItem[]>('/workout-logs/attention'),
  myHistory: (opts?: { limit?: number; offset?: number }) =>
    api.get<HistoryEntry[]>(`/workout-logs/my-history${historyQueryString(opts)}`),
  myHistoryPage: async (opts?: { limit?: number; offset?: number }) => {
    const { data, total } = await api.getWithTotal<HistoryEntry[]>(
      `/workout-logs/my-history${historyQueryString(opts)}`,
    );
    return { items: data, total };
  },
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
  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post<{ ok: boolean }>('/push/subscribe', sub),
  unsubscribe: (endpoint: string) => api.delete<{ ok: boolean }>('/push/subscribe', { endpoint }),
};

// Programas — treino contínuo, mesociclo ou desafio com prazo
export const programsApi = {
  // leitura do aluno
  current: () =>
    api
      .get<{ currentProgram: CurrentProgram | null }>('/programs/current')
      .then((response) => response.currentProgram),
  achievements: () => api.get<ProgramAchievement[]>('/programs/achievements'),

  // gestão (admin)
  list: () => api.get<TrainingProgram[]>('/programs'),
  get: (programId: string) => api.get<TrainingProgram>(`/programs/${programId}`),
  create: (payload: CreateProgramPayload) => api.post<TrainingProgram>('/programs', payload),
  update: (programId: string, payload: UpdateProgramPayload) =>
    api.patch<TrainingProgram>(`/programs/${programId}`, payload),
  remove: (programId: string) => api.delete<{ ok: boolean }>(`/programs/${programId}`),
  assign: (programId: string, userIds: string[]) =>
    api.post<TrainingProgram>(`/programs/${programId}/assignments`, { userIds }),
  currentOfUser: (userId: string) =>
    api
      .get<{ currentProgram: CurrentProgram | null }>(`/programs/users/${userId}/current`)
      .then((response) => response.currentProgram),
  achievementsOfUser: (userId: string) =>
    api.get<ProgramAchievement[]>(`/programs/users/${userId}/achievements`),
  archiveAssignment: (assignmentId: string) =>
    api.patch<{ ok: boolean }>(`/programs/assignments/${assignmentId}/archive`),
};
