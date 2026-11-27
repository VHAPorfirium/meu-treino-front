import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('usa navigator.clipboard.writeText quando disponível e retorna true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    await expect(copyText('@victor.personal')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('@victor.personal');
  });

  it('faz fallback via textarea + execCommand quando clipboard API falha ou não existe', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
        },
      },
      configurable: true,
    });

    const removed = vi.fn();
    const textarea = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
      remove: removed,
    };
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);

    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn().mockReturnValue(textarea),
        body: { appendChild },
        execCommand,
      },
      configurable: true,
    });

    await expect(copyText('SenhaForte1!')).resolves.toBe(true);
    expect(textarea.value).toBe('SenhaForte1!');
    expect(textarea.select).toHaveBeenCalled();
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 'SenhaForte1!'.length);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(removed).toHaveBeenCalled();
  });

  it('retorna false de forma segura quando não há clipboard nem DOM', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: undefined,
      configurable: true,
    });

    await expect(copyText('abc')).resolves.toBe(false);
  });
});
