import RoomsSidebar from '@/components/RoomsSidebar';
import { ReactNode } from 'react';

export default function RoomsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen bg-background">
            <RoomsSidebar />
            <main className="flex-1 bg-muted p-4 sm:p-6 md:p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}