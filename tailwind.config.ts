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
        sand: 'rgb(var(--color-sand) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        card: 'rgb(var(--color-card) / <alpha-value>)',
        chip: 'rgb(var(--color-chip) / <alpha-value>)',
        tableHead: 'rgb(var(--color-table-head) / <alpha-value>)',
        // tinta
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        ink2: 'rgb(var(--color-ink2) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        muted2: 'rgb(var(--color-muted2) / <alpha-value>)',
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        // linhas
        line: 'rgb(var(--color-line) / <alpha-value>)',
        line2: 'rgb(var(--color-line2) / <alpha-value>)',
        line3: 'rgb(var(--color-line3) / <alpha-value>)',
        // marca (ação principal)
        brand: {
          DEFAULT: '#EE4E22',
          700: '#C13B14',
          ink: 'rgb(var(--color-brand-ink) / <alpha-value>)',
        },
        // estados
        done: {
          DEFAULT: 'rgb(var(--color-done) / <alpha-value>)',
          bg: 'rgb(var(--color-done-bg) / <alpha-value>)',
          ink: 'rgb(var(--color-done-ink) / <alpha-value>)',
        },
        skip: {
          DEFAULT: 'rgb(var(--color-skip) / <alpha-value>)',
          bg: 'rgb(var(--color-skip-bg) / <alpha-value>)',
        },
        replace: {
          DEFAULT: 'rgb(var(--color-replace) / <alpha-value>)',
          bg: 'rgb(var(--color-replace-bg) / <alpha-value>)',
        },
        // superfície sempre escura + texto sobre ela (ver globals.css)
        inverse: 'rgb(var(--color-inverse) / <alpha-value>)',
        'on-inverse': {
          DEFAULT: 'rgb(var(--color-on-inverse) / <alpha-value>)',
          muted: 'rgb(var(--color-on-inverse-muted) / <alpha-value>)',
        },
        // texto sobre bg-done / bg-skip / bg-replace
        'on-done': 'rgb(var(--color-on-done) / <alpha-value>)',
        'on-skip': 'rgb(var(--color-on-skip) / <alpha-value>)',
        'on-replace': 'rgb(var(--color-on-replace) / <alpha-value>)',
        // conquistas
        gold: {
          DEFAULT: 'rgb(var(--color-gold) / <alpha-value>)',
          bg: 'rgb(var(--color-gold-bg) / <alpha-value>)',
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
