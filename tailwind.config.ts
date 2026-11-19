import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ["'Bricolage Grotesque'", 'system-ui', 'sans-serif'],
      },
      colors: {
        // base semântica (suporta claro/escuro via CSS variables)
        sand: 'var(--color-sand)',
        paper: 'var(--color-paper)',
        card: 'var(--color-card)',
        chip: 'var(--color-chip)',
        tableHead: 'var(--color-table-head)',
        // tinta
        ink: 'var(--color-ink)',
        ink2: 'var(--color-ink2)',
        muted: 'var(--color-muted)',
        muted2: 'var(--color-muted2)',
        faint: 'var(--color-faint)',
        // linhas
        line: 'var(--color-line)',
        line2: 'var(--color-line2)',
        line3: 'var(--color-line3)',
        // marca (ação principal)
        brand: {
          DEFAULT: '#EE4E22',
          700: '#C13B14',
        },
        // estados
        done: {
          DEFAULT: 'var(--color-done)',
          bg: 'var(--color-done-bg)',
          ink: 'var(--color-done-ink)',
        },
        skip: {
          DEFAULT: 'var(--color-skip)',
          bg: 'var(--color-skip-bg)',
        },
        replace: {
          DEFAULT: 'var(--color-replace)',
          bg: 'var(--color-replace-bg)',
        },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        soft: '0 24px 48px -30px rgba(0,0,0,.4)',
        brand: '0 10px 24px -8px rgba(238,78,34,.55)',
      },
    },
  },
  plugins: [],
};

export default config;
