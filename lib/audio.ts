/**
 * Gerenciador de áudio otimizado para navegadores mobile (incluindo iOS Safari).
 * Destrava o AudioContext em toques de usuário para que alarmes e beeps toquem sem bloqueio.
 */
let sharedContext: AudioContext | null = null;

function getContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

export function unlockAudio() {
  const Ctx = getContextClass();
  if (!Ctx) return;
  if (!sharedContext) {
    sharedContext = new Ctx();
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume();
  }
}

export function playTimerDoneSound() {
  try {
    unlockAudio();
    if (!sharedContext) return;

    const ctx = sharedContext;
    const now = ctx.currentTime;

    // Dois beeps rítmicos distintos
    const playNote = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    playNote(880, now, 0.18);       // nota Lá (A5)
    playNote(1174.66, now + 0.22, 0.35); // nota Ré aguda (D6)
  } catch {
    /* sem suporte a Web Audio */
  }
}
