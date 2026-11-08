import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--onix-accent)',
          hover: 'var(--onix-accent-hover)',
          muted: 'var(--onix-accent-muted)',
          contrast: 'var(--onix-accent-contrast)',
        },
        surface: 'var(--onix-surface)',
        border: {
          DEFAULT: 'var(--onix-border)',
          strong: 'var(--onix-border-strong)',
        },
        ink: {
          DEFAULT: 'var(--onix-text)',
          muted: 'var(--onix-text-muted)',
          subtle: 'var(--onix-text-subtle)',
        },
        canvas: {
          DEFAULT: 'var(--onix-bg)',
          elevated: 'var(--onix-bg-elevated)',
          subtle: 'var(--onix-bg-subtle)',
        },
        success: 'var(--onix-success)',
        warning: 'var(--onix-warning)',
        danger: 'var(--onix-danger)',
        info: 'var(--onix-info)',
      },
      fontFamily: {
        sans: ['var(--onix-font-sans)'],
        display: ['var(--onix-font-display)'],
        mono: ['var(--onix-font-mono)'],
      },
      borderRadius: {
        sm: 'var(--onix-radius-sm)',
        md: 'var(--onix-radius-md)',
        lg: 'var(--onix-radius-lg)',
      },
      boxShadow: {
        sm: 'var(--onix-shadow-sm)',
        md: 'var(--onix-shadow-md)',
      },
    },
  },
  plugins: [],
};

export default config;
