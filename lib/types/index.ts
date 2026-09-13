export type Role = 'ADMIN' | 'TRAINEE';
export type ExerciseStatus = 'DONE' | 'SKIPPED' | 'REPLACED';

export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
}

// O token vem em cookie httpOnly (não no corpo) — o front só recebe o usuário.
export interface LoginResponse {
  user: { id: string; name: string; role: Role };
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

export interface PaginatedExercises {
  items: Exercise[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TodayExercise {
  id: string; // workoutExerciseId
  order: number;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
  exercise: Exercise;
  alternatives: AlternativeExercise[];
}

export interface WorkoutExerciseLog {
  id: string;
  workoutExerciseId: string;
  status: ExerciseStatus;
  actualExerciseId: string | null;
  loadUsed: number | null;
  setsCompleted: number | null;
  note: string | null;
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
  workoutLog: WorkoutLog | null;
  workout: {
    id: string;
    name: string;
    dayOfWeek: number | null;
    exercises: TodayExercise[];
  } | null;
}

export interface Workout {
  id: string;
  name: string;
  dayOfWeek: number | null;
  active: boolean;
  createdAt: string;
  _count?: { exercises: number };
}

export interface WorkoutExerciseItem {
  id: string;
  order: number;
  sets: number;
  reps: string;
  restSeconds: number | null;
  notes: string | null;
  exercise: Exercise;
}

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExerciseItem[];
}

export interface PatchExercisePayload {
  status: ExerciseStatus;
  actualExerciseId?: string;
  loadUsed?: number;
  setsCompleted?: number;
  note?: string;
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
    note: string | null;
    workoutExercise: { exercise: { name: string } };
    actualExercise: { id: string; name: string } | null;
  }[];
}
