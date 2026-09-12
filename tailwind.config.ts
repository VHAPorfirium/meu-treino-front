import type { Config } from 'tailwindcss';

const config: Config = {
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
        // base papel quente
        sand: '#E7E1D9', // fundo mais profundo (desktop)
        paper: '#FBF7F1', // superfície do app
        card: '#FFFFFF',
        chip: '#F2ECE4',
        tableHead: '#F6F0E8',
        // tinta
        ink: '#191512',
        ink2: '#33291F',
        muted: '#5E5348',
        muted2: '#8A7E72',
        faint: '#A99C8F',
        // linhas
        line: '#E9E0D6',
        line2: '#E3DAD0',
        line3: '#DCD2C6',
        // marca (só ação principal)
        brand: {
          DEFAULT: '#EE4E22',
          700: '#C13B14',
        },
        // estados
        done: { DEFAULT: '#1E7A4F', bg: '#E3F0E7', ink: '#14603C' },
        skip: { DEFAULT: '#B06E00', bg: '#FBEBD2' },
        replace: { DEFAULT: '#5B3FBF', bg: '#EAE4FB' },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        soft: '0 24px 48px -30px rgba(25,21,18,.4)',
        brand: '0 10px 24px -8px rgba(238,78,34,.55)',
      },
    },
  },
  plugins: [],
};

export default config;
