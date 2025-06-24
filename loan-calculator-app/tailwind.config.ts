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
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-border': 'var(--card-border)',
        'card-foreground': 'var(--card-foreground)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-hover': 'var(--secondary-hover)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)',
        danger: 'var(--danger)',
        'danger-hover': 'var(--danger-hover)',
        success: 'var(--success)',
      },
    },
  },
  plugins: [],
}
export default config