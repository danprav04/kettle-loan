// src/components/LanguageSwitcher.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useLocale } from '@/components/IntlProvider';
import { FiGlobe, FiChevronDown } from 'react-icons/fi';

export default function LanguageSwitcher() {
    const { locale, setLocale } = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Русский' },
        { code: 'he', name: 'עברית' },
    ];

    const currentLanguageName = languages.find(lang => lang.code === locale)?.name || 'Language';

    const handleLanguageChange = (langCode: string) => {
        setLocale(langCode);
        setIsOpen(false); // Close dropdown after selection
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fixed top-4 right-4 z-50" ref={dropdownRef}>
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center space-x-2 bg-card border border-card-border rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <FiGlobe />
                    <span>{currentLanguageName}</span>
                    <FiChevronDown className={`transition-transform ms-1 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div
                        className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                    >
                        <div className="py-1" role="none">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`w-full text-left block px-4 py-2 text-sm ${
                                        locale === lang.code
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-foreground hover:bg-muted'
                                    }`}
                                    role="menuitem"
                                >
                                    {lang.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}