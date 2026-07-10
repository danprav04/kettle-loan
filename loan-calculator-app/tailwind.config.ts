import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        'card': 'rgb(var(--card) / <alpha-value>)',
        'card-border': 'rgb(var(--card-border) / <alpha-value>)',
        border: 'rgb(var(--card-border) / <alpha-value>)',
        'card-foreground': 'rgb(var(--card-foreground) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-hover': 'rgb(var(--primary-hover) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'secondary-hover': 'rgb(var(--secondary-hover) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--secondary-foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        'input-bg': 'rgb(var(--input-bg) / <alpha-value>)',
        'input-border': 'rgb(var(--input-border) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-hover': 'rgb(var(--danger-hover) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
export default config