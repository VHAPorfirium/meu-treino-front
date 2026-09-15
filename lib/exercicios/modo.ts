import type { Exercise, ExerciseMode } from '@/lib/types';

/**
 * E10 — cardio é medido em tempo, não em repetições.
 *
 * O dataset já separa: exercícios de cardio vêm com `bodyPart = "cardio"` (é o
 * chip "Cardio" do catálogo). Isso **sugere** o modo, mas não manda nele: prancha
 * é abdômen e é por tempo, alongamento também. Por isso o modo é um campo que o
 * admin pode trocar, e não uma regra derivada do grupo muscular.
 */
export function ehCardio(ex: Pick<Exercise, 'bodyPart'>): boolean {
  return (ex.bodyPart ?? '').trim().toLowerCase() === 'cardio';
}

export function modoSugerido(ex: Pick<Exercise, 'bodyPart'>): ExerciseMode {
  return ehCardio(ex) ? 'TIME' : 'REPS';
}

/** 45s · 20 min · 1h05 — formato curto pra caber no subtítulo dos cards. */
export function formataDuracao(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return '—';
  if (segundos < 60) return `${segundos}s`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`;
}

/** Descrição da prescrição de um exercício, nos dois modos. */
export function descrevePrescricao(item: {
  mode: ExerciseMode;
  sets: number;
  reps: string | null;
  durationSeconds: number | null;
}): string {
  return item.mode === 'TIME'
    ? formataDuracao(item.durationSeconds)
    : `${item.sets} × ${item.reps ?? '—'}`;
}
