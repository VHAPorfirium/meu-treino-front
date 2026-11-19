'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';

export default function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function press(digit: string) {
    unlockAudio();
    triggerHaptic('light');
    setError(null);
    if (digit === 'del') setPin((p) => p.slice(0, -1));
    else if (pin.length < 8) {
      const next = pin + digit;
      setPin(next);
    }
  }

  async function submit() {
    unlockAudio();
    if (pin.length < 4) {
      triggerHaptic('warning');
      setError('PIN tem no mínimo 4 dígitos');
      return;
    }
    triggerHaptic('medium');
    setBusy(true);
    setError(null);
    try {
      await login(pin);
      triggerHaptic('success');
    } catch (e) {
      triggerHaptic('warning');
      setError(e instanceof ApiError ? e.message : 'Não foi possível entrar');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell safe-top items-center px-7 pb-8 select-none">
      <div className="mt-14 flex flex-col items-center">
        <div className="font-display text-[15px] font-bold uppercase tracking-[0.2em] text-brand">
          Ritmo
        </div>
        <h1 className="mt-4 font-display text-[34px] font-extrabold tracking-tight text-ink">
          Bora treinar
        </h1>
        <p className="mt-1 text-sm text-muted2">Digite seu PIN para entrar</p>
      </div>

      <div className="mt-8 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full transition-all duration-150 ${
              i < pin.length
                ? 'bg-ink scale-110'
                : 'border-2 border-faint bg-transparent'
            }`}
          />
        ))}
        {pin.length > 4 && (
          <span className="self-center text-sm font-bold text-muted2">
            +{pin.length - 4}
          </span>
        )}
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-brand animate-shake">{error}</p>}

      <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} label={d} onClick={() => press(d)} />
        ))}
        <Key label="⌫" muted onClick={() => press('del')} />
        <Key label="0" onClick={() => press('0')} />
        <Key label={busy ? '…' : 'OK'} primary onClick={submit} disabled={busy} />
      </div>
    </div>
  );
}

function Key({
  label,
  onClick,
  primary,
  muted,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[72px] items-center justify-center rounded-[20px] font-display text-[28px] font-bold transition active:scale-95 ${
        primary
          ? 'bg-brand text-white shadow-brand'
          : muted
            ? 'bg-transparent text-muted2'
            : 'border border-line bg-card text-ink shadow-sm'
      }`}
    >
      {label}
    </button>
  );
}
