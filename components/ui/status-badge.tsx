import type { ExerciseStatus } from '@/lib/types';

const map: Record<ExerciseStatus, { label: string; cls: string; icon: string }> = {
  DONE: { label: 'Feito', cls: 'bg-done-bg text-done-ink', icon: '✓' },
  SKIPPED: { label: 'Pulado', cls: 'bg-skip-bg text-skip', icon: '✕' },
  REPLACED: { label: 'Trocado', cls: 'bg-replace-bg text-replace', icon: '⇄' },
};

export function StatusBadge({ status }: { status: ExerciseStatus }) {
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${s.cls}`}
    >
      {s.icon} {s.label}
    </span>
  );
}

// cores de estado p/ uso inline (barra lateral, chip circular)
export const STATUS_COLOR: Record<ExerciseStatus, { fg: string; bg: string }> = {
  DONE: { fg: '#1E7A4F', bg: '#E3F0E7' },
  SKIPPED: { fg: '#B06E00', bg: '#FBEBD2' },
  REPLACED: { fg: '#5B3FBF', bg: '#EAE4FB' },
};

export const STATUS_ICON: Record<ExerciseStatus, string> = {
  DONE: '✓',
  SKIPPED: '✕',
  REPLACED: '⇄',
};
