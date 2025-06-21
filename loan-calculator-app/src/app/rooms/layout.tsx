"use client";

import RoomsSidebar from '@/components/RoomsSidebar';
import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FiMenu } from 'react-icons/fi';

export default function RoomsLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on route change
    useEffect(() => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <div className="h-screen flex bg-background">
            {/* Overlay for mobile, appears when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar container. Handles mobile slide-in and static desktop display. */}
            <div
                className={`fixed top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <RoomsSidebar closeSidebar={() => setIsSidebarOpen(false)} />
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile-only header */}
                <header className="md:hidden flex items-center justify-start p-2 bg-card border-b border-card-border sticky top-0 z-10">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-md text-foreground"
                        aria-label="Open menu"
                    >
                        <FiMenu size={24} />
                    </button>
                </header>
                
                {/* Main content area */}
                <main className="flex-1 bg-muted p-4 sm:p-6 md:p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}