import type { ProgramReport } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from './program-type-rules';

/** "Desafio 30 Dias Concluído com Sucesso!" / "Mesociclo de 4 semanas concluído!" */
export function buildAchievementTitle(programReport: ProgramReport): string {
  if (programReport.programType === 'CHALLENGE') {
    return `Desafio ${programReport.totalDays} Dias Concluído com Sucesso!`;
  }
  const label = PROGRAM_TYPE_RULES[programReport.programType].label;
  return `${label} concluído com sucesso!`;
}

/** "30 dias de foco · 24 treinos realizados · +18% de evolução de carga" */
export function buildAchievementStatsLine(programReport: ProgramReport): string {
  const statParts = [
    `${programReport.totalDays} dias de foco`,
    `${programReport.completedWorkoutsCount} treino${programReport.completedWorkoutsCount === 1 ? '' : 's'} realizado${programReport.completedWorkoutsCount === 1 ? '' : 's'}`,
  ];
  if (programReport.loadEvolutionPercentage != null) {
    const sign = programReport.loadEvolutionPercentage >= 0 ? '+' : '';
    statParts.push(`${sign}${programReport.loadEvolutionPercentage}% de evolução de carga`);
  }
  return statParts.join(' · ');
}
