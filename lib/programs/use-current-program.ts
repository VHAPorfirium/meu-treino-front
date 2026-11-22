'use client';

import { useCallback, useState } from 'react';
import type { CurrentProgram, ProgramReport } from '@/lib/types';
import { programsApi } from '@/lib/api/endpoints';
import { markAchievementAsCelebrated, wasAchievementCelebrated } from './celebration-memory';

export interface PendingCelebration {
  assignmentId: string;
  programReport: ProgramReport;
}

/**
 * Programa atual do aluno + comemoração automática quando ele acabou de ser
 * concluído (aqui, em outro aparelho ou numa finalização que estava offline).
 * Falha de rede aqui nunca trava a tela: o programa só não aparece.
 */
export function useCurrentProgram() {
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [isCurrentProgramLoaded, setIsCurrentProgramLoaded] = useState(false);
  const [celebration, setCelebration] = useState<PendingCelebration | null>(null);

  const loadCurrentProgram = useCallback(async () => {
    try {
      const loadedProgram = await programsApi.current();
      setCurrentProgram(loadedProgram);
      if (
        loadedProgram?.status === 'COMPLETED' &&
        loadedProgram.report &&
        !wasAchievementCelebrated(loadedProgram.assignmentId)
      ) {
        setCelebration({ assignmentId: loadedProgram.assignmentId, programReport: loadedProgram.report });
      }
    } catch {
      /* sem rede: segue sem o programa */
    } finally {
      setIsCurrentProgramLoaded(true);
    }
  }, []);

  function openAchievementOfCurrentProgram() {
    if (currentProgram?.report) {
      setCelebration({ assignmentId: currentProgram.assignmentId, programReport: currentProgram.report });
    }
  }

  function closeCelebration() {
    if (celebration) markAchievementAsCelebrated(celebration.assignmentId);
    setCelebration(null);
  }

  return {
    currentProgram,
    isCurrentProgramLoaded,
    celebration,
    loadCurrentProgram,
    openAchievementOfCurrentProgram,
    closeCelebration,
  };
}
