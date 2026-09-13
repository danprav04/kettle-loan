'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiHelpCircle } from 'react-icons/fi';

interface InfoTooltipProps {
    content: string;
    align?: 'left' | 'right' | 'center';
    className?: string;
    iconClassName?: string;
}

export default function InfoTooltip({
    content,
    align = 'center',
    className = '',
    iconClassName = ''
}: InfoTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when tapping/clicking outside on mobile or desktop
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isOpen]);

    // Alignment classes for desktop/tablet
    let alignClass = 'left-1/2 -translate-x-1/2';
    if (align === 'left') {
        alignClass = 'left-0';
    } else if (align === 'right') {
        alignClass = 'right-0';
    }

    return (
        <div
            ref={containerRef}
            className={`relative inline-flex items-center align-middle ${className}`}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                className={`inline-flex items-center justify-center p-0.5 text-muted-foreground/70 hover:text-primary focus:outline-none transition-colors rounded-full ${iconClassName}`}
                aria-label="More information"
            >
                <FiHelpCircle className="w-3.5 h-3.5" />
            </button>

            {isOpen && (
                <div
                    className={`absolute bottom-full mb-2 ${alignClass} w-64 sm:w-72 max-w-[85vw] p-3 rounded-xl bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 text-[11px] sm:text-xs leading-relaxed border border-slate-700/70 shadow-2xl backdrop-blur-md z-50 animate-fadeIn pointer-events-auto select-text font-normal font-sans text-start`}
                    role="tooltip"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-slate-200">
                        {content}
                    </div>

                    {/* Arrow Pointer */}
                    <div
                        className={`absolute top-full -mt-1 border-4 border-transparent border-t-slate-800 ${
                            align === 'left' ? 'left-3' : align === 'right' ? 'right-3' : 'left-1/2 -translate-x-1/2'
                        }`}
                    />
                </div>
            )}
        </div>
    );
}
