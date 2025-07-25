// src/components/RoomsSidebar.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FiCopy, FiCheck, FiSun, FiMoon, FiGlobe, FiX, FiLogOut, FiXCircle, FiWifiOff, FiLoader, FiCheckCircle } from 'react-icons/fi';
import Icon from '@mdi/react';
import { mdiKettle } from '@mdi/js';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/IntlProvider';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import ConfirmationDialog from './ConfirmationDialog';
import { useSync } from './SyncProvider';
import { handleApi } from '@/lib/api';
import { saveRoomsList, getRoomsList } from '@/lib/offline-sync';

interface Room {
    id: number;
    code: string;
}

interface RoomsSidebarProps {
    closeSidebar: () => void;
}

export default function RoomsSidebar({ closeSidebar }: RoomsSidebarProps) {
    const t = useTranslations('Rooms');
    const tAccess = useTranslations('Accessibility');
    const tNotif = useTranslations('Notifications');
    const router = useRouter();
    const pathname = usePathname();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [roomCode, setRoomCode] = useState('');
    const [notification, setNotification] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();
    const { locale, setLocale } = useLocale();
    const { isSimplified, setIsSimplified } = useSimplifiedLayout();
    const { isOnline, isSyncing, pendingRequestCount, isReadyForOffline } = useSync();

    const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
    const [selectedRoomToLeave, setSelectedRoomToLeave] = useState<Room | null>(null);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        router.push('/');
    }, [router]);

    const fetchRooms = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        const localRooms = await getRoomsList();
        if (localRooms.length > 0) {
            setRooms(localRooms);
        }

        if (isOnline) {
            try {
                const fetchedRooms = await handleApi({ method: 'GET', url: '/api/user/rooms' });
                if (fetchedRooms && Array.isArray(fetchedRooms)) {
                    setRooms(fetchedRooms);
                    await saveRoomsList(fetchedRooms);
                }
            } catch (error) {
                console.warn("Failed to fetch rooms from network, using local data.", error);
            }
        }
        setIsLoading(false);
    }, [isOnline, router]);

    useEffect(() => {
        fetchRooms();
        window.addEventListener('syncdone', fetchRooms);
        return () => window.removeEventListener('syncdone', fetchRooms);
    }, [fetchRooms]);

    const handleCopyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        }).catch(() => setNotification(t('copyFailed')));
    };

    const handleJoinOrCreateRoom = async (options: { roomCode?: string }) => {
        setNotification('');
        const isCreating = !options.roomCode;
        const body = isCreating ? {} : { roomCode: options.roomCode };
        
        try {
            const result = await handleApi({ method: 'POST', url: '/api/rooms', body });
            if (result?.optimistic) {
                setNotification(tNotif('requestQueued'));
                setRoomCode('');
                return;
            }
            if (result.roomId) {
                setRoomCode('');
                await fetchRooms();
                router.push(`/rooms/${result.roomId}`);
                closeSidebar();
            } else {
                setNotification(isCreating ? t('createFailed') : t('joinFailed'));
            }
        } catch {
             setNotification(isCreating ? t('createFailed') : t('joinFailed'));
        }
    };

    const handleJoinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomCode.trim()) return;
        handleJoinOrCreateRoom({ roomCode });
    };

    const openLeaveDialog = (room: Room) => {
        setSelectedRoomToLeave(room);
        setIsLeaveDialogOpen(true);
    };

    const handleLeaveRoom = async () => {
        if (!selectedRoomToLeave) return;
        setNotification('');
        
        const originalRooms = rooms;
        setRooms(prev => prev.filter(r => r.id !== selectedRoomToLeave!.id));
        setIsLeaveDialogOpen(false);
        if (pathname.includes(`/rooms/${selectedRoomToLeave.id}`)) {
            router.push('/rooms');
        }

        try {
            await saveRoomsList(rooms.filter(r => r.id !== selectedRoomToLeave!.id));
            const result = await handleApi({ method: 'DELETE', url: `/api/rooms/${selectedRoomToLeave.id}/members` });
            if (result?.optimistic) {
                setNotification(tNotif('requestQueued'));
            }
        } catch {
            setNotification(t('leaveRoomFailed'));
            setRooms(originalRooms);
            await saveRoomsList(originalRooms);
        } finally {
            setSelectedRoomToLeave(null);
        }
    };

    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    const cycleLanguage = () => setLocale(l => (l === 'en' ? 'ru' : l === 'ru' ? 'he' : 'en'));
    const toggleSimplifiedLayout = () => setIsSimplified(prev => !prev);

    return (
        <>
            <aside className="w-80 bg-card border-e border-card-border h-full p-4 flex flex-col">
                <div className="flex items-center justify-between mb-6 px-2">
                     <h2 className="text-2xl font-bold text-card-foreground">{t('myRooms')}</h2>
                    <div className="flex items-center space-x-2">
                        {isOnline && !isSyncing && isReadyForOffline && (
                            <FiCheckCircle className="text-success" title={tNotif('offlineReady')} />
                        )}
                        {isSyncing && (
                            <FiLoader className="animate-spin text-primary" title={tNotif('syncing')} />
                        )}
                        {!isOnline && (
                             <div 
                                className="flex items-center space-x-1 text-muted-foreground" 
                                title={`${tNotif('youAreOffline')} ${pendingRequestCount > 0 ? tNotif('pendingSync', { count: pendingRequestCount }) : ''}`.trim()}
                             >
                                <FiWifiOff />
                                {pendingRequestCount > 0 && (
                                    <span className="text-xs font-bold bg-danger text-white rounded-full h-4 w-4 flex items-center justify-center">
                                        {pendingRequestCount}
                                    </span>
                                )}
                            </div>
                        )}
                        <button onClick={closeSidebar} className="md:hidden p-1 rounded-md hover:bg-muted text-muted-foreground">
                            <FiX size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto -mx-2 pr-1 animate-fadeIn">
                    {isLoading ? (
                        <div className="text-center text-muted-foreground p-4">{t('loadingRooms')}</div>
                    ) : (
                        <ul>
                            {rooms.map((room) => {
                                const isActive = pathname === `/rooms/${room.id}` || pathname.startsWith(`/rooms/${room.id}/`);
                                return (
                                    <li key={room.id}>
                                        <div className={`group flex items-center justify-between rounded-lg transition-colors mb-2 ${isActive ? 'bg-primary text-primary-foreground' : 'text-card-foreground hover:bg-muted'}`}>
                                            <Link href={`/rooms/${room.id}`} onClick={closeSidebar} className="flex-grow p-3 text-sm font-semibold truncate">
                                                Room #{room.code}
                                            </Link>
                                            <div className="flex items-center">
                                                <button onClick={() => handleCopyToClipboard(room.code)} className={`p-3 rounded-lg transition-all duration-200 ${isActive ? 'hover:bg-primary-hover' : 'hover:bg-card-border'} opacity-50 group-hover:opacity-100`} title={t('copyRoomCode')} >
                                                    {copiedCode === room.code ? <FiCheck className="text-success animate-scaleIn" /> : <FiCopy className="group-hover:scale-110 transition-transform" />}
                                                </button>
                                                <button onClick={() => openLeaveDialog(room)} className={`p-3 rounded-lg transition-all duration-200 ${isActive ? 'hover:bg-primary-hover' : 'hover:bg-card-border'} opacity-50 group-hover:opacity-100`} title={t('leaveRoom')} >
                                                    <FiXCircle className="group-hover:scale-110 transition-transform text-danger" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="mt-auto pt-4 border-t border-card-border">
                    {notification && <p className="text-blue-600 dark:text-blue-400 text-sm text-center mb-2 animate-fadeIn">{notification}</p>}
                    <form onSubmit={handleJoinSubmit} className="mb-4">
                        <input type="text" placeholder={t('roomCode')} value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} className="w-full px-3 py-2 rounded-lg mb-2 themed-input" />
                        <button type="submit" className="w-full py-2 rounded-lg btn-primary">{t('joinRoom')}</button>
                    </form>
                    <div className="flex items-center my-2">
                        <div className="flex-grow border-t border-card-border"></div>
                        <span className="flex-shrink mx-2 text-xs text-muted-foreground">{t('or')}</span>
                        <div className="flex-grow border-t border-card-border"></div>
                    </div>
                    <button onClick={() => handleJoinOrCreateRoom({})} className="w-full py-2 rounded-lg btn-secondary mb-4">{t('createRoom')}</button>
                    <div className="space-y-2">
                        <button onClick={handleLogout} className="w-full py-2 px-4 flex items-center justify-center rounded-lg btn-muted" aria-label={t('logout')}>
                            <FiLogOut size={16} className="me-2"/>
                            <span className="font-semibold text-xs">{t('logout')}</span>
                        </button>
                        <div className="flex items-center justify-center space-x-2">
                             <button onClick={toggleTheme} className="flex items-center justify-center w-full p-2 rounded-md btn-muted" aria-label={tAccess('toggleTheme')} >
                                {theme === 'light' ? <FiMoon size={16} /> : <FiSun size={16} />}
                            </button>
                             <button onClick={cycleLanguage} className="flex items-center justify-center w-full p-2 rounded-md btn-muted" aria-label={tAccess('changeLanguage')} >
                                <FiGlobe size={16} className="me-1.5"/>
                                <span className="font-semibold text-xs">{locale.toUpperCase()}</span>
                            </button>
                             <button onClick={toggleSimplifiedLayout} className={`flex items-center justify-center w-full p-2 rounded-md btn-muted transition-colors ${isSimplified ? 'text-primary' : ''}`} aria-label={tAccess('toggleSimplifiedLayout')} >
                                 <Icon path={mdiKettle} size={0.75} />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
            <ConfirmationDialog isOpen={isLeaveDialogOpen} onClose={() => setIsLeaveDialogOpen(false)} onConfirm={handleLeaveRoom} title={t('leaveRoomTitle')}>
                {t('leaveRoomConfirmation', { code: selectedRoomToLeave?.code ?? '' })}
            </ConfirmationDialog>
        </>
    );
}