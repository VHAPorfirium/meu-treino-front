export type EventTone = 'done' | 'brand' | 'skip' | 'neutral';

export interface AccessEventMeta {
  value: string;
  label: string;
  tone: EventTone;
}

export const ACCESS_EVENT_OPTIONS: AccessEventMeta[] = [
  { value: 'auth.login.success', label: 'Login aprovado', tone: 'done' },
  { value: 'auth.login.failure', label: 'Falha de login', tone: 'skip' },
  { value: 'auth.login.locked', label: 'Login bloqueado', tone: 'brand' },
  { value: 'auth.logout', label: 'Logout', tone: 'neutral' },
  { value: 'auth.unauthorized', label: 'Não autenticado (401)', tone: 'skip' },
  { value: 'authz.denied', label: 'Acesso negado (403)', tone: 'brand' },
  { value: 'ratelimit.exceeded', label: 'Rate limit (429)', tone: 'brand' },
  { value: 'auth.profile.switched', label: 'Troca de perfil', tone: 'neutral' },
  { value: 'auth.password.changed', label: 'Senha alterada', tone: 'done' },
  { value: 'auth.password.reset', label: 'Senha redefinida', tone: 'skip' },
  { value: 'auth.account.created', label: 'Conta criada', tone: 'done' },
  { value: 'auth.account.updated', label: 'Conta editada', tone: 'neutral' },
  { value: 'auth.account.deactivated', label: 'Conta desativada', tone: 'skip' },
  { value: 'auth.account.reactivated', label: 'Conta reativada', tone: 'done' },
  { value: 'link.requested', label: 'Convite de vínculo', tone: 'neutral' },
  { value: 'link.accepted', label: 'Vínculo aceito', tone: 'done' },
  { value: 'link.rejected', label: 'Vínculo recusado', tone: 'neutral' },
  { value: 'link.ended', label: 'Vínculo encerrado', tone: 'skip' },
];

const EVENT_MAP = new Map<string, AccessEventMeta>(
  ACCESS_EVENT_OPTIONS.map((item) => [item.value, item]),
);

export function describeAccessEvent(event: string): AccessEventMeta {
  return (
    EVENT_MAP.get(event) ?? {
      value: event,
      label: event,
      tone: 'neutral',
    }
  );
}

/** Formata duração em segundos como "3d 4h", "2h 15m" ou "12m 8s". */
export function formatUptime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const mins = Math.floor((safe % 3_600) / 60);
  const secs = safe % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/** Formata milissegundos de forma enxuta ("42 ms" ou "1.25 s"). */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

/** Converte intervalo rápido ('24h' | '7d' | '30d' | 'all') para data ISO `from`. */
export function resolvePeriodFromIso(
  period: '24h' | '7d' | '30d' | 'all',
  nowMs = Date.now(),
): string | undefined {
  if (period === 'all') return undefined;
  const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30;
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString();
}

/** Formata 'YYYY-MM-DD' como '27/11'. */
export function formatShortBrDay(dayKey: string): string {
  const parts = dayKey.split('-');
  if (parts.length !== 3) return dayKey;
  return `${parts[2]}/${parts[1]}`;
}
