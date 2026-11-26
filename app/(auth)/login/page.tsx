'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';

export default function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = useCallback(
    (digit: string) => {
      if (busy) return;
      unlockAudio();
      triggerHaptic('light');
      setError(null);
      if (digit === 'del') setPin((p) => p.slice(0, -1));
      else setPin((p) => (p.length < 8 ? p + digit : p));
    },
    [busy],
  );

  const submit = useCallback(async () => {
    if (busy) return;
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
  }, [busy, login, pin]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        press('del');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [press, submit]);

  return (
    <div className="app-shell safe-top safe-bottom items-center px-6 select-none sm:px-7">
      <div className="mt-8 flex flex-col items-center sm:mt-14">
        <div className="font-display text-[30px] font-extrabold uppercase tracking-[0.22em] text-brand">
          Ritmo
        </div>
        <h1 className="mt-6 text-center font-display text-[24px] font-extrabold tracking-tight text-ink">
          Que bom te ver de novo 👋
        </h1>
        <p className="mt-1 text-sm font-semibold text-muted2">Digite seu PIN para entrar</p>
      </div>

      <div className="mt-8 flex gap-4" aria-label={`${pin.length} dígitos informados`}>
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

      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-brand animate-shake">
          {error}
        </p>
      )}

      <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} label={d} onClick={() => press(d)} disabled={busy} />
        ))}
        <Key label="⌫" ariaLabel="Apagar último dígito" muted onClick={() => press('del')} disabled={busy} />
        <Key label="0" onClick={() => press('0')} disabled={busy} />
        <Key label={busy ? '…' : '→'} ariaLabel="Entrar" primary onClick={submit} disabled={busy} />
      </div>

      <p className="mt-7 text-center text-xs font-bold text-muted2">Esqueceu o PIN? Fale com seu personal</p>
    </div>
  );
}

function Key({
  label,
  ariaLabel,
  onClick,
  primary,
  muted,
  disabled,
}: {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-[72px] items-center justify-center rounded-[20px] font-display text-[28px] font-bold transition active:scale-95 disabled:opacity-50 ${
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
