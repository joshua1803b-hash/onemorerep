/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Commissioner', 'sans-serif']
      },
      colors: {
        divider: '#F0F0F0',
        secondary: '#999999'
      }
    }
  },
  plugins: []
}
