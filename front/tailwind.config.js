/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#14213D', deep: '#0B1426', soft: '#3A4A6B', mist: '#EEF1F7' },
        orange: { DEFAULT: '#F77F00', deep: '#D96F00', light: '#FFA94D', mist: '#FFF4E8' },
        canvas: '#F5F6FA',
        line: '#E2E8F0',
        ink: { DEFAULT: '#14213D', soft: '#64748B', muted: '#94A3B8' },
        plate: '#2F6FB5',
      },
      fontFamily: { sans: ['Cairo', 'Tahoma', 'Arial', 'sans-serif'] },
      maxWidth: { page: '76rem' },
    },
  },
  plugins: [],
};
