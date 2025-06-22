"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Room {
    id: number;
    code: string;
}

export default function RoomsPage() {
    const t = useTranslations('Rooms');
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkRoomsAndRedirect = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.replace('/'); // Use replace to avoid back-button issues
                return;
            }

            try {
                const res = await fetch('/api/user/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const rooms: Room[] = await res.json();
                    if (rooms && rooms.length > 0) {
                        // Redirect to the most recent room
                        router.replace(`/rooms/${rooms[0].id}`);
                    } else {
                        // No rooms, so stop loading and show the welcome message
                        setIsLoading(false);
                    }
                } else if (res.status === 401) {
                    // Unauthorized, redirect to login
                    router.replace('/');
                } else {
                    // Handle other errors, stop loading to prevent infinite loop
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch rooms", error);
                setIsLoading(false); // Stop loading on network or other errors
            }
        };

        checkRoomsAndRedirect();
    }, [router]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">Loading your rooms...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="text-center bg-card p-8 rounded-lg shadow-md border border-card-border max-w-md animate-scaleIn">
                <h1 className="text-2xl font-bold text-card-foreground">
                    {t('joinOrCreateRoom')}
                </h1>
                <p className="text-muted-foreground mt-2">
                    Select a room from the panel on the left or create a new one to get started.
                </p>
            </div>
        </div>
    );
}