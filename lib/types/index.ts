export type Role = 'ADMIN' | 'TRAINEE';
export type ExerciseStatus = 'DONE' | 'SKIPPED' | 'REPLACED';
/** E10 — REPS = séries × repetições (+ carga) · TIME = duração (cardio, prancha). */
export type ExerciseMode = 'REPS' | 'TIME';
/** Status do treino de hoje (E9). */
export type StatusDoDia = 'nao_iniciado' | 'em_andamento' | 'concluido';

export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
}

// O token vem em cookie httpOnly (não no corpo) — o front só recebe o usuário.
export interface LoginResponse {
  user: { id: string; name: string; role: Role };
}

/** Usuário resumido (sem dados sensíveis) — GET /users */
export interface UserSummary {
  id: string;
  name: string;
  role: Role;
}

export interface MuscleGroup {
  id: string;
  name: string;
  displayName: string;
  exerciseCount: number;
}

export interface Exercise {
  id: string;
  externalId?: string;
  name: string;
  target: string;
  bodyPart: string;
  equipment: string | null;
  gifUrl: string | null;
  thumbnailUrl: string | null;
  instructions: string | null;
  instructionsEn?: string | null;
  attribution?: string | null;
}

export interface AlternativeExercise {
  id: string;
  name: string;
  equipment: string | null;
  gifUrl: string | null;
  thumbnailUrl: string | null;
}

/**
 * Página do catálogo. `total`/`totalPages` são calculados COM os filtros aplicados,
 * e `page` volta já ajustada ao intervalo válido — dá pra navegar por todos os
 * 1.324 exercícios sem perder nenhum.
 */
export interface PaginatedExercises {
  items: Exercise[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * E7 — montador em lote. A configuração vive como **string** enquanto o
 * exercício está selecionado no picker (é o que os inputs manipulam); só vira
 * número na hora de montar o payload.
 */
export interface ConfigExercicio {
  mode: ExerciseMode;
  sets: string;
  reps: string;
  /** E10 — minutos, quando `mode === 'TIME'` */
  minutes: string;
  rest: string;
}

export interface ExercicioSelecionado {
  exercise: Exercise;
  config: ConfigExercicio;
}

/** Um item do `POST /workouts/:id/exercises/batch`. Sem `order`: quem define é o servidor. */
export interface AddExerciseBatchItem {
  exerciseId: string;
  mode?: ExerciseMode;
  sets?: number;
  /** obrigatório no modo REPS */
  reps?: string;
  /** obrigatório no modo TIME */
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
}

export interface TodayExercise {
  id: string; // workoutExerciseId
  order: number;
  mode: ExerciseMode;
  sets: number;
  reps: string | null; // null no modo TIME
  durationSeconds: number | null; // preenchido no modo TIME
  restSeconds: number | null;
  notes: string | null;
  exercise: Exercise;
  alternatives: AlternativeExercise[];
}

/** E4 — uma série executada. */
export interface SetLog {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  /** E10 — duração executada do bloco, em segundos */
  durationSeconds?: number | null;
}

export interface WorkoutExerciseLog {
  id: string;
  workoutExerciseId: string;
  status: ExerciseStatus;
  actualExerciseId: string | null;
  loadUsed: number | null;
  setsCompleted: number | null;
  totalSeconds?: number | null;
  note: string | null;
  sets?: SetLog[];
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  date: string;
  completed: boolean;
  exerciseLogs: WorkoutExerciseLog[];
}

export interface TodayResponse {
  /** E9 — vem preenchido mesmo quando a sessão já foi CONCLUÍDA. */
  workoutLog: WorkoutLog | null;
  /** true = não havia treino marcado pra hoje; este é um treino "sugerido" (E1.1) */
  isFallback?: boolean;
  /** E9 — estado da sessão de hoje. */
  status: StatusDoDia;
  /** E9 — ISO da conclusão, quando `status === 'concluido'`. */
  concluidoEm: string | null;
  /** E9 — 'YYYY-MM-DD' em que o treino volta a liberar. */
  proximaLiberacao: string | null;
  workout: {
    id: string;
    name: string;
    dayOfWeek: number | null;
    exercises: TodayExercise[];
  } | null;
}

export interface Assignee {
  id: string;
  name: string;
}

export interface Workout {
  id: string;
  name: string;
  dayOfWeek: number | null;
  active: boolean;
  createdAt: string;
  _count?: { exercises: number };
  assignees?: Assignee[];
}

export interface WorkoutExerciseItem {
  id: string;
  order: number;
  mode: ExerciseMode;
  sets: number;
  reps: string | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: Exercise;
}

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExerciseItem[];
  assignees: Assignee[];
}

export interface SetLogInput {
  setNumber: number;
  weight?: number;
  reps?: number;
  /** E10 — duração do bloco, em segundos */
  durationSeconds?: number;
}

export interface PatchExercisePayload {
  status: ExerciseStatus;
  actualExerciseId?: string;
  loadUsed?: number;
  setsCompleted?: number;
  /** E10 — tempo total; derivado de `sets` quando elas vierem */
  totalSeconds?: number;
  note?: string;
  /** E4 — substitui todas as séries do exercício nesta sessão (idempotente) */
  sets?: SetLogInput[];
}

export interface ProgressSummary {
  sessions: { last30days: number; delta: number; target: number };
  adherence: {
    pct: number;
    completedExercises: number;
    totalExercises: number;
    deltaPp: number;
  };
  streak: { current: number; best: number };
  cargaTotal: { current: number; deltaPct: number };
  /** E10 — minutos de exercício por tempo (cardio) nos últimos 30 dias */
  cardio: { minutes: number; deltaPct: number };
  heatmap: { date: string; level: number }[];
  ranking: { name: string; type: 'skip' | 'swap'; count: number }[];
  recentNotes: { text: string; exercise: string; date: string }[];
  // mantidos (evolução)
  frequency: { last30days: number; byWeek: { week: string; count: number }[] };
  mostSkipped: { exercise: string; count: number }[];
  mostReplaced: { from: string; to: string; count: number }[];
  loadProgression: {
    exercise: string;
    points: { date: string; loadUsed: number }[];
  }[];
}

export interface HistoryEntry {
  id: string;
  date: string;
  completed: boolean;
  workout: { id: string; name: string };
  user: { id: string; name: string };
  exerciseLogs: {
    id: string;
    status: ExerciseStatus;
    loadUsed: number | null;
    setsCompleted: number | null;
    totalSeconds?: number | null;
    note: string | null;
    sets?: SetLog[];
    workoutExercise: { exercise: { name: string } };
    actualExercise: { id: string; name: string } | null;
  }[];
}

/** E6 — recado do personal pra aluna */
export interface TrainerNote {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  readAt: string | null;
  createdAt: string;
  from: { id: string; name: string };
}

/** E6 — foto de progresso (URL assinada, expira em ~1h) */
export interface ProgressPhoto {
  id: string;
  userId: string;
  path: string;
  takenAt: string;
  note: string | null;
  url: string | null;
}
