import type { ProgramType } from '@/lib/types';

interface ProgramTypeRule {
  label: string;
  description: string;
  icon: string;
  /** Campo de duração que o tipo exige (null = sem duração). */
  durationField: 'targetWeeks' | 'targetDays' | null;
  durationUnitLabel: string | null;
  maximumDuration: number | null;
  hasDeadline: boolean;
  badgeClassName: string;
}

/**
 * Espelho da `ProgramDurationPolicy` do back. Nenhum componente decide sozinho
 * "se é desafio faz X": todos leem daqui.
 */
export const PROGRAM_TYPE_RULES: Record<ProgramType, ProgramTypeRule> = {
  CONTINUOUS: {
    label: 'Treino contínuo',
    description: 'Rotina constante, sem data para acabar',
    icon: '🔁',
    durationField: null,
    durationUnitLabel: null,
    maximumDuration: null,
    hasDeadline: false,
    badgeClassName: 'bg-chip text-muted',
  },
  MESOCYCLE: {
    label: 'Mesociclo',
    description: 'Fase com duração em semanas',
    icon: '🏋️',
    durationField: 'targetWeeks',
    durationUnitLabel: 'semanas',
    maximumDuration: 52,
    hasDeadline: true,
    badgeClassName: 'bg-replace-bg text-replace',
  },
  CHALLENGE: {
    label: 'Desafio',
    description: 'Prazo fechado em dias, termina com troféu',
    icon: '🎯',
    durationField: 'targetDays',
    durationUnitLabel: 'dias',
    maximumDuration: 365,
    hasDeadline: true,
    badgeClassName: 'bg-gold-bg text-gold',
  },
};

export const PROGRAM_TYPES_IN_DISPLAY_ORDER: ProgramType[] = ['CONTINUOUS', 'MESOCYCLE', 'CHALLENGE'];

/** "30 dias", "4 semanas" ou "Sem prazo". */
export function formatProgramDuration(program: {
  type: ProgramType;
  targetWeeks: number | null;
  targetDays: number | null;
}): string {
  const programTypeRule = PROGRAM_TYPE_RULES[program.type];
  if (!programTypeRule.durationField) return 'Sem prazo';
  const durationValue = program[programTypeRule.durationField];
  return `${durationValue ?? '?'} ${programTypeRule.durationUnitLabel}`;
}
