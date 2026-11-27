'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { roleHome } from '@/lib/auth/storage';
import { authApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { passwordChecklist, validateStrongPassword } from '@/lib/auth/credentials';
import { triggerHaptic } from '@/lib/haptics';

export default function TrocarSenhaPage() {
  const { user, loading, logout, completePasswordChange } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="app-shell items-center justify-center">
        <p className="text-muted2">Carregando…</p>
      </div>
    );
  }

  const check = passwordChecklist(newPassword);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (!currentPassword) {
      triggerHaptic('warning');
      setError('Informe sua senha atual.');
      return;
    }

    const strength = validateStrongPassword(newPassword);
    if (!strength.valid) {
      triggerHaptic('warning');
      setError(strength.reason ?? 'A nova senha não atende aos requisitos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      triggerHaptic('warning');
      setError('A confirmação não confere com a nova senha.');
      return;
    }

    if (newPassword === currentPassword) {
      triggerHaptic('warning');
      setError('A nova senha deve ser diferente da senha atual.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      triggerHaptic('success');
      completePasswordChange();
    } catch (err) {
      triggerHaptic('warning');
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível atualizar a senha.',
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-line bg-paper px-4 py-3 text-base font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none transition';

  return (
    <div className="app-shell safe-top safe-bottom items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="font-display text-[26px] font-extrabold uppercase tracking-[0.22em] text-brand">
            Ritmo
          </div>
          <h1 className="mt-4 font-display text-[24px] font-extrabold tracking-tight text-ink">
            Defina sua nova senha
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-muted2">
            Olá, {user.name.split(' ')[0]}!{' '}
            {user.mustChangePassword
              ? 'Por segurança, crie uma senha pessoal forte antes de continuar.'
              : 'Atualize sua senha de acesso abaixo.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-4 rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-7"
        >
          <div className="space-y-1.5">
            <label htmlFor="pwd-current" className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              Senha atual
            </label>
            <input
              id="pwd-current"
              name="current-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Digite sua senha atual ou temporária"
              value={currentPassword}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setCurrentPassword(e.target.value);
              }}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="pwd-new" className="block text-xs font-extrabold uppercase tracking-wide text-muted">
                Nova senha
              </label>
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="text-xs font-extrabold text-brand-ink hover:underline"
              >
                {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
              </button>
            </div>
            <input
              id="pwd-new"
              name="new-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              value={newPassword}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setNewPassword(e.target.value);
              }}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pwd-confirm" className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              Confirmar nova senha
            </label>
            <input
              id="pwd-confirm"
              name="confirm-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              disabled={busy}
              onChange={(e) => {
                setError(null);
                setConfirmPassword(e.target.value);
              }}
              className={inputClass}
            />
          </div>

          <ul className="grid grid-cols-1 gap-1.5 rounded-2xl border border-line bg-paper p-3.5 text-xs font-bold sm:grid-cols-2">
            <ChecklistRow ok={check.minLength} label="Mínimo 8 caracteres" />
            <ChecklistRow ok={check.hasLetter} label="Pelo menos 1 letra" />
            <ChecklistRow ok={check.hasNumber} label="Pelo menos 1 número" />
            <ChecklistRow ok={check.hasSpecial} label="1 caractere especial (!@#$)" />
          </ul>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-sm font-semibold text-brand-ink animate-shake"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3.5 text-base font-extrabold text-white shadow-brand transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>

          <div className="flex items-center justify-between pt-1">
            {!user.mustChangePassword ? (
              <button
                type="button"
                onClick={() => router.replace(roleHome(user.role))}
                className="text-xs font-extrabold text-muted hover:text-ink"
              >
                ← Voltar
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs font-extrabold text-muted2 hover:text-brand-ink"
            >
              Sair da conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-done' : 'text-muted2'}`}>
      <span aria-hidden="true">{ok ? '✓' : '○'}</span>
      <span>{label}</span>
    </li>
  );
}
