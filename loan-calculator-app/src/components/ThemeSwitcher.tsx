// src/components/ThemeSwitcher.tsx
"use client";

import { useTheme } from '@/components/ThemeProvider';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <div className="fixed top-4 left-4 z-50">
            <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-12 h-12 bg-card border border-card-border rounded-md text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
            </button>
        </div>
    );
}