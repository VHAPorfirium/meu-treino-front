'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function press(digit: string) {
    setError(null);
    if (digit === 'del') setPin((p) => p.slice(0, -1));
    else if (pin.length < 8) {
      const next = pin + digit;
      setPin(next);
    }
  }

  async function submit() {
    if (pin.length < 4) {
      setError('PIN tem no mínimo 4 dígitos');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(pin);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível entrar');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell safe-top items-center px-7 pb-8">
      <div className="mt-16 flex flex-col items-center">
        <div className="font-display text-[15px] font-bold uppercase tracking-[0.2em] text-brand">
          Ritmo
        </div>
        <h1 className="mt-5 font-display text-[36px] font-extrabold tracking-tight">
          Bora treinar
        </h1>
        <p className="mt-1.5 text-[15px] text-muted2">Digite seu PIN para entrar</p>
      </div>

      <div className="mt-10 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full ${
              i < pin.length
                ? 'bg-ink'
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

      {error && <p className="mt-4 text-sm font-semibold text-brand">{error}</p>}

      <div className="mt-10 grid w-full max-w-xs grid-cols-3 gap-4">
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
      className={`flex h-[76px] items-center justify-center rounded-[22px] font-display text-[30px] font-bold transition active:scale-95 ${
        primary
          ? 'bg-brand text-white shadow-brand'
          : muted
            ? 'bg-transparent text-muted2'
            : 'border border-line bg-card text-ink'
      }`}
    >
      {label}
    </button>
  );
}
