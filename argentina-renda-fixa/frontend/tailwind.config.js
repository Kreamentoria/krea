/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        argentina: {
          blue: '#74ACDF',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
