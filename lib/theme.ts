/** Preferência de tema claro/escuro sincronizada com o script inicial em app/layout.tsx. */
export const THEME_STORAGE_KEY = 'theme_preference';

export function readInitialIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* Safari privado / restrição de storage */
  }
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const LIGHT_THEME_COLOR = '#FBF7F1';
export const DARK_THEME_COLOR = '#121214';

export function syncThemeColorMeta(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const color = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => {
    meta.content = color;
  });
}

export function applyThemePreference(isDark: boolean, persist = true): void {
  if (typeof document === 'undefined') return;
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
  syncThemeColorMeta(isDark);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      /* ignora falha de storage */
    }
  }
}
