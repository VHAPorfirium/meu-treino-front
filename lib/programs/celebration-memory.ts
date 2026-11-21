/**
 * Lembra quais conquistas já foram comemoradas neste aparelho, para a animação
 * aparecer uma vez só — mesmo quando a conclusão veio de outro aparelho ou de
 * uma finalização que estava offline.
 */
const CELEBRATED_KEY_PREFIX = 'ritmo:conquista-comemorada:';

export function wasAchievementCelebrated(assignmentId: string): boolean {
  try {
    return window.localStorage.getItem(CELEBRATED_KEY_PREFIX + assignmentId) === '1';
  } catch {
    return false;
  }
}

export function markAchievementAsCelebrated(assignmentId: string): void {
  try {
    window.localStorage.setItem(CELEBRATED_KEY_PREFIX + assignmentId, '1');
  } catch {
    /* armazenamento indisponível: no pior caso a comemoração aparece de novo */
  }
}
