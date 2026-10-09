"use client";

import RoomsSidebar from '@/components/RoomsSidebar';
import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FiMenu } from 'react-icons/fi';
import Icon from '@mdi/react';
import { mdiKettle } from '@mdi/js';

export default function RoomsLayout({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar on route change for better mobile UX
    useEffect(() => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <div className="h-screen flex bg-background overflow-hidden">
            {/* Overlay for mobile, appears when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar container. Handles mobile slide-in and static desktop display. */}
            <div
                className={`fixed top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:shrink-0 bg-background ${
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <RoomsSidebar closeSidebar={() => setIsSidebarOpen(false)} />
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile-only header */}
                <header className="md:hidden flex items-center justify-between px-3 py-2 bg-card border-b border-card-border sticky top-0 z-10">
                    <div className="flex items-center space-x-2.5">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors"
                            aria-label="Open menu"
                        >
                            <FiMenu size={22} />
                        </button>
                        <div className="flex items-center space-x-2 text-primary font-bold tracking-tight text-lg">
                            <Icon path={mdiKettle} size={1.1} />
                            <span className="text-card-foreground">Kettle</span>
                        </div>
                    </div>
                </header>
                
                {/* Main content area */}
                <main className="flex-1 overflow-y-auto min-h-0 bg-muted p-2 sm:p-4 md:p-5">
                    {children}
                </main>
            </div>
        </div>
    );
}