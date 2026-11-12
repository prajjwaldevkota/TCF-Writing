/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        exam: {
          bg: '#f8fafc',
          card: '#ffffff',
          border: '#cbd5e1',
          accent: '#0284c7',
          header: '#0f172a',
          sidebar: '#f1f5f9',
          active: '#e0f2fe'
        }
      }
    },
  },
  plugins: [],
}
