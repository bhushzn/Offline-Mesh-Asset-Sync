/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: '#0a0d0f',
          surface: '#11161a',
          card: '#161c22',
          border: '#232c35',
          'border-light': '#313e4b',
          muted: '#6b7d8e',
          text: '#e2e8f0',
          accent: '#ff5533',       // Tactical Coral / Hazard Red-Orange
          'accent-hover': '#e64422',
          emerald: '#10b981',      // Calming green / Healthy
          'emerald-glow': '#059669',
          cyan: '#06b6d4',         // Tactical Link / Telemetry
          amber: '#f59e0b',        // Alert / Degraded
          purple: '#8b5cf6',       // CRDT Mesh
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'tactical-glow': '0 0 15px rgba(255, 85, 51, 0.25)',
        'emerald-glow': '0 0 15px rgba(16, 185, 129, 0.25)',
        'cyan-glow': '0 0 15px rgba(6, 182, 212, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar-sweep 4s linear infinite',
      },
      keyframes: {
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        }
      }
    },
  },
  plugins: [],
}
