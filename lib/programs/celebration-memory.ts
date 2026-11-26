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

/** Remove todas as marcas de comemoração deste aparelho (chamado no logout/401). */
export function clearCelebratedAchievements(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CELEBRATED_KEY_PREFIX)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* armazenamento indisponível */
  }
}
