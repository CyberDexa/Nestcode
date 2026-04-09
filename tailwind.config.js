/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        display: ['"Cabinet Grotesk"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // RGB triplet → supports Tailwind opacity modifier (bg-nest/10 etc.)
        nest: {
          DEFAULT: 'rgb(var(--color-nest) / <alpha-value>)',
          50: '#E6FFF8',
          100: '#B3FFE9',
          200: '#66FFD4',
          300: '#33FFCA',
          400: '#00FFBB',
          500: '#00D4AA',
          600: '#00A888',
          700: '#007D66',
          800: '#005244',
          900: '#002922',
          glow: 'rgba(0, 212, 170, 0.25)',
        },
        // CSS variables → change with theme
        surface: {
          0: 'var(--color-surface-0)',
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
          4: 'var(--color-surface-4)',
          5: 'var(--color-surface-5)',
          6: 'var(--color-surface-6)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        status: {
          success: 'rgb(var(--color-nest) / <alpha-value>)',
          warning: 'rgb(255 176 32 / <alpha-value>)',
          error: 'rgb(255 68 102 / <alpha-value>)',
          info: '#4499FF',
          modified: '#FFB020',
          added: 'rgb(var(--color-nest) / <alpha-value>)',
          deleted: 'rgb(255 68 102 / <alpha-value>)',
        },
        accent: {
          purple: '#8866FF',
          blue: '#4499FF',
          pink: '#FF44AA',
          orange: '#FF8833',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 212, 170, 0.15)',
        'glow-lg': '0 0 40px rgba(0, 212, 170, 0.25)',
        'glow-sm': '0 0 10px rgba(0, 212, 170, 0.10)',
        panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
        'panel-lg': '0 8px 48px rgba(0, 0, 0, 0.6)',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-right': 'slideRight 0.15s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'typing': 'typing 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 212, 170, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 170, 0.4)' },
        },
        typing: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};
