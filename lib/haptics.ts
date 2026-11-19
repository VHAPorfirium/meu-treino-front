/**
 * Haptic feedback utilitário para interações táteis em smartphones.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([20, 40, 30]);
        break;
      case 'warning':
        navigator.vibrate([40, 60, 40]);
        break;
    }
  } catch {
    /* vibração não suportada ou desabilitada pelo navegador */
  }
}
