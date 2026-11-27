import { describe, expect, it } from 'vitest';
import { buildAccessLogsQueryString } from '../api/endpoints';
import {
  describeAccessEvent,
  formatLatencyMs,
  formatShortBrDay,
  formatUptime,
  resolvePeriodFromIso,
} from './formatters';

describe('admin formatters & query builder', () => {
  it('formata uptime de forma legível para segundos, minutos, horas e dias', () => {
    expect(formatUptime(42)).toBe('42s');
    expect(formatUptime(125)).toBe('2m 5s');
    expect(formatUptime(7_500)).toBe('2h 5m');
    expect(formatUptime(2 * 86_400 + 3 * 3_600)).toBe('2d 3h');
  });

  it('formata latência em ms e segundos acima de 1000ms', () => {
    expect(formatLatencyMs(38.4)).toBe('38 ms');
    expect(formatLatencyMs(1250)).toBe('1.25 s');
    expect(formatLatencyMs(-5)).toBe('0 ms');
  });

  it('descreve eventos conhecidos com rótulo pt-BR e severidade e faz fallback seguro', () => {
    expect(describeAccessEvent('auth.login.locked')).toMatchObject({
      label: 'Login bloqueado',
      tone: 'brand',
    });
    expect(describeAccessEvent('auth.login.success').tone).toBe('done');
    expect(describeAccessEvent('evento.futuro')).toEqual({
      value: 'evento.futuro',
      label: 'evento.futuro',
      tone: 'neutral',
    });
  });

  it('resolve períodos rápidos e monta query string de AccessLog sem campos vazios', () => {
    const fixedNow = Date.parse('2026-11-27T12:00:00.000Z');
    expect(resolvePeriodFromIso('24h', fixedNow)).toBe('2026-11-26T12:00:00.000Z');
    expect(resolvePeriodFromIso('7d', fixedNow)).toBe('2026-11-20T12:00:00.000Z');
    expect(resolvePeriodFromIso('all', fixedNow)).toBeUndefined();
    expect(formatShortBrDay('2026-11-27')).toBe('27/11');

    expect(
      buildAccessLogsQueryString({
        event: 'auth.login.failure',
        ip: ' 10.0.0.1 ',
        search: '',
        limit: 25,
        offset: 50,
      }),
    ).toBe('?event=auth.login.failure&ip=10.0.0.1&limit=25&offset=50');
    expect(buildAccessLogsQueryString({})).toBe('');
  });
});
