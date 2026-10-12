// src/app/rooms/[roomId]/coverage/page.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FiBarChart2, FiUsers, FiColumns } from 'react-icons/fi';
import { useSync } from '@/components/SyncProvider';
import { getRoomData, Entry, saveRoomData } from '@/lib/offline-sync';
import { useUser } from '@/components/UserProvider';
import { StatsMember } from '@/lib/stats-calc';
import BilateralCheckCoverage from '@/components/BilateralCheckCoverage';

function CoveragePageContent() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const searchParams = useSearchParams();
    const t = useTranslations('Stats');
    const tRoom = useTranslations('Room');
    const { isOnline } = useSync();
    const { user } = useUser();
    const router = useRouter();

    const paramA = searchParams.get('a');
    const paramB = searchParams.get('b');
    const initialPersonAId = paramA ? parseInt(paramA, 10) : null;
    const initialPersonBId = paramB ? parseInt(paramB, 10) : null;

    const [entries, setEntries] = useState<Entry[]>([]);
    const [members, setMembers] = useState<StatsMember[]>([]);
    const [roomName, setRoomName] = useState<string | null>(null);
    const [currency, setCurrency] = useState('ILS');
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token || !user) {
            router.push('/');
            return;
        }

        const localData = await getRoomData(roomId);
        if (localData) {
            setEntries(localData.entries || []);
            setMembers((localData.members || []) as StatsMember[]);
            if (localData.name) setRoomName(localData.name);
            if (localData.currency) setCurrency(localData.currency);
            setIsLoading(false);
        }

        if (isOnline) {
            try {
                const res = await fetch(`/api/rooms/${roomId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    await saveRoomData(roomId, data);
                    setEntries(data.entries || []);
                    setMembers((data.members || []) as StatsMember[]);
                    if (data.name) setRoomName(data.name);
                    if (data.currency) setCurrency(data.currency);
                } else if (res.status === 401) {
                    router.push('/');
                }
            } catch (e) {
                console.error("Failed to refresh coverage data.", e);
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, user]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', fetchData);
        return () => window.removeEventListener('syncdone', fetchData);
    }, [fetchData]);

    return (
        <div className="max-w-5xl mx-auto animate-scaleIn pb-12 space-y-4">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                    onClick={() => router.back()}
                    className="font-bold py-2 px-4 rounded-xl btn-primary text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                    {tRoom('backToRoom')}
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                    {roomName && (
                        <span className="text-xs font-bold text-muted-foreground bg-card px-3 py-1.5 rounded-xl border border-card-border hidden sm:inline-block">
                            {roomName}
                        </span>
                    )}
                    <Link
                        href={`/rooms/${roomId}/balance`}
                        className="inline-flex items-center gap-1.5 font-bold py-2 px-3.5 rounded-xl bg-card hover:bg-muted text-foreground border border-card-border text-xs sm:text-sm shadow-xs transition-all active:scale-95"
                    >
                        <FiUsers className="w-4 h-4 text-primary shrink-0" />
                        <span>{t('bilateralBackToBalance')}</span>
                    </Link>
                    <Link
                        href={`/rooms/${roomId}/stats`}
                        className="inline-flex items-center gap-1.5 font-bold py-2 px-3.5 rounded-xl bg-card hover:bg-muted text-foreground border border-card-border text-xs sm:text-sm shadow-xs transition-all active:scale-95"
                    >
                        <FiBarChart2 className="w-4 h-4 text-primary shrink-0" />
                        <span>{t('bilateralBackToStats')}</span>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-card shadow-lg rounded-2xl border border-card-border p-16 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-muted-foreground text-xs font-semibold">{t('loadingStats')}</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="bg-card shadow-lg rounded-2xl border border-card-border p-16 text-center flex flex-col items-center justify-center gap-2">
                    <FiColumns className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm font-medium">{t('noEntriesStats')}</p>
                </div>
            ) : (
                <div className="bg-card shadow-lg rounded-2xl border border-card-border p-4 sm:p-6">
                    <BilateralCheckCoverage
                        entries={entries}
                        members={members}
                        currency={currency}
                        currentUserId={user?.userId}
                        roomId={roomId}
                        initialPersonAId={initialPersonAId && !isNaN(initialPersonAId) ? initialPersonAId : null}
                        initialPersonBId={initialPersonBId && !isNaN(initialPersonBId) ? initialPersonBId : null}
                        isDedicatedPage={true}
                    />
                </div>
            )}
        </div>
    );
}

export default function BilateralCoveragePage() {
    return (
        <Suspense fallback={<div className="p-16 text-center text-muted-foreground text-xs">Loading...</div>}>
            <CoveragePageContent />
        </Suspense>
    );
}
