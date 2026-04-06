/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        'dash-bg': '#0d1117',
        'dash-surface': '#161b22',
        'dash-accent': '#1f6feb',
        'dash-text': '#e6edf3',
        'dash-text-secondary': '#8b949e',
        'dash-border': '#30363d'
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
}
