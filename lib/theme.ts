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

export function applyThemePreference(isDark: boolean, persist = true): void {
  if (typeof document === 'undefined') return;
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      /* ignora falha de storage */
    }
  }
}
