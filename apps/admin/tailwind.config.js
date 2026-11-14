/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          main: 'var(--bg-main)',
          surface: 'var(--bg-surface)',
          card: 'var(--bg-card)',
          secondary: 'var(--bg-card)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          focus: 'var(--border-focus)',
        },
        replit: {
          orange: 'var(--replit-orange)',
          'orange-hover': 'var(--replit-orange-hover)',
        },
        text: {
          main: 'var(--text-main)',
          muted: 'var(--text-muted)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
