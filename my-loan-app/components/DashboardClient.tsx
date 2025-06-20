'use client';

import { useState, useEffect } from 'react';
import RoomManager from './RoomManager';
import EntryManager from './EntryManager';
import { useTranslations } from 'next-intl';

export default function DashboardClient({ initialData, lang }: { initialData: any, lang: string }) {
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const t = useTranslations('Dashboard');

    useEffect(() => {
        if (initialData) {
            setData(initialData);
            setLoading(false);
        }
    }, [initialData]);

    const refreshData = async () => {
        const res = await fetch('/api/dashboard');
        const newData = await res.json();
        setData(newData);
    };

    if (loading) {
        return <div>Loading...</div>;
    }
    
    const hasRooms = data.rooms && data.rooms.length > 0;
    const isOnlyOneRoom = hasRooms && data.rooms.length === 1;

    return (
        <div className="container mx-auto p-4">
             <h1 className="text-2xl font-bold mb-4">{t('welcome', {username: data.username})}</h1>
            
            {!hasRooms && <RoomManager onRoomAction={refreshData} />}

            {isOnlyOneRoom && <EntryManager room={data.rooms[0].room} userId={data.id} onEntryAdded={refreshData} />}
            
            {hasRooms && !isOnlyOneRoom && (
                 <div>
                    {/* Here you can add logic to select a room if there are multiple */}
                    <p>You are in multiple rooms. Please select a room:</p>
                     {data.rooms.map((userRoom: any) => (
                         <div key={userRoom.room.id} className="p-4 my-2 border rounded-md">
                           <EntryManager room={userRoom.room} userId={data.id} onEntryAdded={refreshData} />
                         </div>
                     ))}
                 </div>
            )}
        </div>
    );
}