// src/app/rooms/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSync } from '@/components/SyncProvider';
import { handleApi } from '@/lib/api';
import { saveRoomsList, getRoomsList } from '@/lib/offline-sync';

export default function RoomsPage() {
    const t = useTranslations('Rooms');
    const router = useRouter();
    const { isOnline } = useSync();
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState(t('loadingRooms'));

    useEffect(() => {
        const checkRoomsAndRedirect = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.replace('/');
                return;
            }

            let rooms = await getRoomsList();

            if (isOnline) {
                try {
                    const fetchedRooms = await handleApi({ method: 'GET', url: '/api/user/rooms' });
                    if (fetchedRooms && Array.isArray(fetchedRooms)) {
                        await saveRoomsList(fetchedRooms);
                        rooms = fetchedRooms;
                    }
                } catch (error) {
                    console.warn("Could not fetch user rooms, using local data.", error);
                    setStatusMessage("Couldn't refresh rooms. Using offline data.");
                }
            }

            if (rooms.length > 0) {
                router.replace(`/rooms/${rooms[0].id}`);
            } else {
                if (!isOnline) {
                    setStatusMessage("Connect to the internet once to download your rooms for offline use.");
                }
                setIsLoading(false);
            }
        };

        checkRoomsAndRedirect();
    }, [router, isOnline, t]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-muted-foreground">{statusMessage}</p>
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
                    {t('selectOrCreateRoomPrompt')}
                </p>
            </div>
        </div>
    );
}