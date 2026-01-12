import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          950: '#0b0f12',
          900: '#11171c',
          800: '#1a2229',
          700: '#232d35',
        },
        accent: {
          500: '#84d1ff',
          600: '#5bbef5',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(132, 209, 255, 0.2), 0 12px 40px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
