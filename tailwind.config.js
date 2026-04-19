/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors for astrophotography tool
        cosmos: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d4fe',
          300: '#a5b8fc',
          400: '#8191f8',
          500: '#636af1',
          600: '#4e4ae5',
          700: '#423bca',
          800: '#3733a3',
          900: '#312f81',
          950: '#0f0f23',
        },
      },
    },
  },
  plugins: [],
};
