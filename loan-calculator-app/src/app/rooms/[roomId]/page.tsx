// src/app/rooms/[roomId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { FiInfo, FiEdit, FiSave, FiX, FiLoader, FiShield, FiSliders } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { saveRoomData, getRoomData, addLocalEntry, updateLocalRoomName, LocalRoomData, Entry } from '@/lib/offline-sync';
import { useSync } from '@/components/SyncProvider';
import { RoomRoleProvider, RoomRole } from '@/components/RoleContext';
import AdminPanel from '@/components/AdminPanel';
import PayerBeneficiarySelector, { ShareItem, SelectorMember } from '@/components/PayerBeneficiarySelector';

interface Member {
    id: number;
    username: string;
    role?: string;
}

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const { roomId } = params;
    const t = useTranslations('Room');
    const { isSimplified } = useSimplifiedLayout();
    const { isOnline } = useSync();

    const [balance, setBalance] = useState(0);
    const [roomCode, setRoomCode] = useState('');
    const [roomName, setRoomName] = useState<string | null>(null);
    const [currency, setCurrency] = useState('ILS');
    const [currentUserRole, setCurrentUserRole] = useState<RoomRole>('active');
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [entryType, setEntryType] = useState<'expense' | 'loan'>('expense');
    const [isMultiPartyMode, setIsMultiPartyMode] = useState(false);

    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [includeSelfInSplit, setIncludeSelfInSplit] = useState(true);
    const [loanPaidByUserIds, setLoanPaidByUserIds] = useState<Set<number>>(new Set());

    // Multi-party state
    const [payerShares, setPayerShares] = useState<ShareItem[]>([]);
    const [beneficiaryShares, setBeneficiaryShares] = useState<ShareItem[]>([]);

    const otherMembers = useMemo(() => members.filter((m: Member) => m.id !== currentUserId), [members, currentUserId]);

    const updateStateFromData = useCallback((data: LocalRoomData) => {
        setBalance(data.currentUserBalance || 0);
        setRoomCode(data.code || '');
        setRoomName(data.name || null);
        setNewName(data.name || '');
        setMembers(data.members || []);
        setCurrentUserId(data.currentUserId || null);
        if (data.currency) setCurrency(data.currency);
        if (data.currentUserRole && ['admin', 'active', 'passive', 'observer'].includes(data.currentUserRole)) {
            setCurrentUserRole(data.currentUserRole as RoomRole);
        }
        
        const eligible = (data.members || []).filter(m => m.role !== 'observer');
        if (eligible.length > 0 && payerShares.length === 0 && data.currentUserId) {
            setPayerShares([{ userId: data.currentUserId, percentage: 100 }]);
            const count = eligible.length;
            const base = Math.floor((100 / count) * 100) / 100;
            const rem = Math.round((100 - base * count) * 100) / 100;
            setBeneficiaryShares(eligible.map((m, idx) => ({
                userId: m.id,
                percentage: idx === 0 ? Math.round((base + rem) * 100) / 100 : base
            })));
        }

        if (members.length === 0 && data.members.length > 0) {
            const initialSelected = (data.members || [])
                .filter((m: Member) => m.id !== data.currentUserId && m.role !== 'observer')
                .map((m: Member) => m.id);
            setSelectedMemberIds(new Set(initialSelected));
            setIncludeSelfInSplit(true);
            if (initialSelected.length > 0) {
                setLoanPaidByUserIds(new Set([initialSelected[0]]));
            }
        }
    }, [members.length, payerShares.length]);

    const fetchData = useCallback(async (options: { forceLocal?: boolean } = {}) => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/');
            return;
        }

        if (isOnline && !options.forceLocal) {
            try {
                const data = await handleApi({ method: 'GET', url: `/api/rooms/${roomId}` });
                if (data) {
                    await saveRoomData(roomId, data);
                    updateStateFromData(data);
                }
            } catch (e) {
                console.warn("Online fetch failed, falling back to local data.", e);
                const localData = await getRoomData(roomId);
                if (localData) updateStateFromData(localData);
            }
        } else {
            const localData = await getRoomData(roomId);
            if (localData) {
                updateStateFromData(localData);
            } else {
                setNotification(t('offlineRoomDataError'));
            }
        }
        setIsLoading(false);
    }, [roomId, router, isOnline, t, updateStateFromData]);

    const handleSyncDone = useCallback(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        fetchData();
        window.addEventListener('syncdone', handleSyncDone);
        return () => window.removeEventListener('syncdone', handleSyncDone);
    }, [fetchData, handleSyncDone]);
    
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (isSimplified) {
            setEntryType('loan');
        } else {
            const savedEntryType = localStorage.getItem('entryType') as 'expense' | 'loan';
            setEntryType(savedEntryType && ['expense', 'loan'].includes(savedEntryType) ? savedEntryType : 'expense');
        }
    }, [isSimplified]);

    const handleSetEntryType = (type: 'expense' | 'loan') => {
        if (isSimplified) return;
        setEntryType(type);
        localStorage.setItem('entryType', type);
    };

    const handleSaveName = async () => {
        if (!newName.trim() || newName.trim() === roomName) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        setNotification(null);
        
        const oldName = roomName;
        const trimmedNewName = newName.trim();

        setRoomName(trimmedNewName);
        await updateLocalRoomName(roomId, trimmedNewName);
        setIsEditingName(false);
        
        try {
            const result = await handleApi({
                method: 'PUT',
                url: `/api/rooms/${roomId}`,
                body: { name: trimmedNewName }
            });
            
            if (result?.optimistic) {
                setNotification(t('requestQueued'));
            } else if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to save room name:", error);
            setNotification('Failed to save name.');
            setRoomName(oldName);
            if (oldName) await updateLocalRoomName(roomId, oldName);
        } finally {
            setIsSavingName(false);
        }
    };

    const handleStartEditingName = () => {
        setNewName(roomName || '');
        setIsEditingName(true);
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotification(null);
        const parsedAmount = Math.abs(parseFloat(amount));
        const currentUser = members.find((m: Member) => m.id === currentUserId);
        if (isNaN(parsedAmount) || parsedAmount <= 0 || !currentUserId || !currentUser) return;

        let finalSplitWithIds: number[] | null = null;
        let finalPayerShares: ShareItem[] | null = null;
        let finalBeneficiaryShares: ShareItem[] | null = null;

        if (isMultiPartyMode) {
            const sumP = payerShares.reduce((a, b) => a + b.percentage, 0);
            const sumB = beneficiaryShares.reduce((a, b) => a + b.percentage, 0);
            if (Math.abs(sumP - 100) > 0.1 || Math.abs(sumB - 100) > 0.1) {
                setNotification('Percentages must sum exactly to 100% on both lists.');
                return;
            }
            finalPayerShares = payerShares;
            finalBeneficiaryShares = beneficiaryShares;
            finalSplitWithIds = beneficiaryShares.map(b => b.userId);
        } else if (entryType === 'expense') {
            const participants = new Set<number>(selectedMemberIds);
            if (includeSelfInSplit && currentUserId) participants.add(currentUserId);
            finalSplitWithIds = participants.size > 0 ? Array.from(participants) : members.filter(m => m.role !== 'observer').map((m: Member) => m.id);
        } else if (entryType === 'loan' && !isSimplified) {
            finalSplitWithIds = loanPaidByUserIds.size > 0 ? Array.from(loanPaidByUserIds) : null;
        }

        const finalAmount = entryType === 'loan' ? -parsedAmount : parsedAmount;

        const optimisticEntry: Entry = {
            id: `temp-${Date.now()}`,
            amount: finalAmount.toFixed(2),
            description,
            created_at: new Date().toISOString(),
            username: currentUser.username,
            user_id: finalPayerShares && finalPayerShares.length > 0 ? finalPayerShares[0].userId : currentUserId,
            split_with_user_ids: finalSplitWithIds,
            payer_shares: finalPayerShares,
            beneficiary_shares: finalBeneficiaryShares,
            created_by_user_id: currentUserId,
            offline_timestamp: Date.now()
        };
        
        await addLocalEntry(roomId, optimisticEntry);
        await fetchData({ forceLocal: true });
        
        setAmount('');
        setDescription('');

        try {
            const result = await handleApi({
                method: 'POST',
                url: '/api/entries',
                body: { 
                    roomId, 
                    amount: finalAmount, 
                    description, 
                    splitWithUserIds: finalSplitWithIds,
                    payerShares: finalPayerShares,
                    beneficiaryShares: finalBeneficiaryShares,
                    createdAt: optimisticEntry.created_at
                },
            });

            if (result?.optimistic) {
                setNotification(t('requestQueued'));
            } else if (isOnline) {
                fetchData();
            }
        } catch (error) {
            console.error("Failed to add entry:", error);
            setNotification('Failed to add entry. Please try again.');
            fetchData();
        }
    };

    const handleMemberSelection = (memberId: number) => {
        const newSelection = new Set(selectedMemberIds);
        if (newSelection.has(memberId)) {
            newSelection.delete(memberId);
        } else {
            newSelection.add(memberId);
        }
        setSelectedMemberIds(newSelection);
    };

    const isSubmitDisabled = amount === '' || description === '';
    const isViewOnly = currentUserRole === 'observer' || currentUserRole === 'passive';

    return (
        <RoomRoleProvider role={currentUserRole} currency={currency}>
            <div className="h-full overflow-y-auto pb-4 sm:pb-0">
                {isLoading ? (
                    <div className="max-w-md mx-auto p-8 text-center text-muted-foreground animate-fadeIn">Loading room...</div>
                ) : (
                    <div className="max-w-lg mx-auto bg-card rounded-xl shadow-md overflow-hidden border border-card-border animate-scaleIn">
                        <div className="p-4 sm:p-5 md:p-6 lg:p-8">
                            {/* Title & Admin Button */}
                            <div className="text-center mb-3 sm:mb-5 relative">
                                {isEditingName ? (
                                    <div className="flex items-center space-x-2 rtl:space-x-reverse animate-fadeIn">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="w-full px-3 py-1 text-lg sm:text-xl font-bold text-center rounded-lg themed-input"
                                            autoFocus
                                            onKeyDown={(e) => { e.key === 'Enter' && handleSaveName(); }}
                                        />
                                        <button onClick={handleSaveName} className="p-2 btn-primary rounded-lg" disabled={isSavingName} aria-label="Save name">
                                            {isSavingName ? <FiLoader className="animate-spin" /> : <FiSave />}
                                        </button>
                                        <button onClick={() => setIsEditingName(false)} className="p-2 btn-muted rounded-lg" aria-label="Cancel editing name">
                                            <FiX />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2 rtl:space-x-reverse group">
                                        <h1 className="text-lg sm:text-xl font-bold text-card-foreground">
                                            {roomName || t('roomTitle', { code: roomCode })}
                                        </h1>
                                        {currentUserRole === 'admin' && (
                                            <button onClick={handleStartEditingName} className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit room name">
                                                <FiEdit />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">Room Code: {roomCode}</span>
                                    <span className="text-[10px] bg-primary/10 text-primary uppercase font-bold px-1.5 py-0.2 rounded border border-primary/20">{currentUserRole}</span>
                                </div>

                                {currentUserRole === 'admin' && (
                                    <button
                                        onClick={() => setIsAdminPanelOpen(true)}
                                        className="absolute right-0 top-0 p-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-purple-500/20"
                                        title="Room Administration"
                                    >
                                        <FiShield /> <span className="hidden sm:inline">Admin</span>
                                    </button>
                                )}
                            </div>

                            {/* Balance */}
                            <div className="text-center mb-3 sm:mb-5">
                                <div className="text-base sm:text-lg font-medium text-muted-foreground">{t('balanceTitle')}</div>
                                <div className={`text-3xl sm:text-4xl font-bold mt-1 ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {balance.toFixed(2)} {currency}
                                </div>
                                <Link href={`/rooms/${roomId}/balance`} className="text-xs sm:text-sm text-primary hover:underline flex items-center justify-center mx-auto mt-2">
                                    {t('detailed')}
                                </Link>
                            </div>

                            <div className="border-t border-card-border my-3 sm:my-5"></div>

                            {/* Notifications */}
                            {notification && (
                                <div className="mb-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-800 flex items-center animate-fadeIn">
                                    <FiInfo className="me-2 shrink-0"/>
                                    <span>{notification}</span>
                                </div>
                            )}

                            {/* Entry Form or View-Only Alert */}
                            {isViewOnly ? (
                                <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
                                    <FiShield className="mx-auto text-amber-500 text-2xl" />
                                    <h3 className="font-bold text-foreground">View-Only Access</h3>
                                    <p className="text-xs text-muted-foreground">
                                        As a {currentUserRole}, you can observe balances and records, but cannot log or modify entries. Contact a room Admin to request active permissions.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                                        <h2 className="text-lg sm:text-xl font-semibold text-card-foreground">
                                            {isSimplified ? t('simplifiedNewEntryTitle') : t('newEntryTitle')}
                                        </h2>

                                        {!isSimplified && otherMembers.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsMultiPartyMode(!isMultiPartyMode)}
                                                className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all border ${
                                                    isMultiPartyMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted border-border'
                                                }`}
                                            >
                                                <FiSliders className="text-[11px]" />
                                                <span>{isMultiPartyMode ? 'Advanced Split' : 'Simple Split'}</span>
                                            </button>
                                        )}
                                    </div>

                                    <form onSubmit={handleAddEntry} className="space-y-4">
                                        {!isSimplified && !isMultiPartyMode && (
                                            <div>
                                                <div className="relative flex w-full rounded-full bg-muted p-1">
                                                    <span
                                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-300 ease-in-out bg-card border-2 ${entryType === 'expense' ? 'border-primary' : 'border-success'}`}
                                                        style={{ transform: entryType === 'loan' ? 'translateX(calc(100% - 4px))' : 'translateX(0)' }}
                                                    />
                                                    <button type="button" onClick={() => handleSetEntryType('expense')} className={`z-10 w-1/2 py-2 text-xs sm:text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'expense' ? 'text-primary' : 'text-muted-foreground'}`}>
                                                        {t('expense')}
                                                    </button>
                                                    <button type="button" onClick={() => handleSetEntryType('loan')} className={`z-10 w-1/2 py-2 text-xs sm:text-sm font-semibold transition-colors duration-300 rounded-full ${entryType === 'loan' ? 'text-success' : 'text-muted-foreground'}`}>
                                                        {t('loan')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Amount & Description Inputs */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-1">
                                                <label className="block text-muted-foreground text-xs font-bold mb-1" htmlFor="amount">{t('amount')} ({currency})</label>
                                                <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 leading-tight rounded-lg themed-input font-bold" required min="0" step="any" placeholder="0.00" />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="block text-muted-foreground text-xs font-bold mb-1" htmlFor="description">{t('description')}</label>
                                                <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 leading-tight rounded-lg themed-input" required placeholder="Dinner, Taxi, Rent..." />
                                            </div>
                                        </div>

                                        {/* Multi-Party Two List Selector */}
                                        {isMultiPartyMode && !isSimplified && (
                                            <div className="space-y-4 pt-2 animate-fadeIn">
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={payerShares}
                                                    onChange={setPayerShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={currency}
                                                    label="List 1: Who Paid?"
                                                    currentUserId={currentUserId}
                                                />
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={beneficiaryShares}
                                                    onChange={setBeneficiaryShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={currency}
                                                    label="List 2: Split For Whom?"
                                                    currentUserId={currentUserId}
                                                />
                                            </div>
                                        )}

                                        {/* Simple Split Selector */}
                                        {!isMultiPartyMode && entryType === 'expense' && !isSimplified && otherMembers.length > 0 && (
                                            <div className="bg-muted/40 p-3 rounded-lg animate-fadeIn border border-border/50">
                                                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-2">Split With:</label>
                                                <div className="space-y-1.5 max-h-28 overflow-y-auto px-1">
                                                    {currentUserId && (
                                                        <div className="flex items-center">
                                                            <input id="share-with-me" type="checkbox" checked={includeSelfInSplit} onChange={(e) => setIncludeSelfInSplit(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                                            <label htmlFor="share-with-me" className="ms-2 block text-xs font-medium text-foreground">{t('me')}</label>
                                                        </div>
                                                    )}
                                                    {otherMembers.filter(m => m.role !== 'observer').map((member: Member) => (
                                                        <div key={member.id} className="flex items-center">
                                                            <input id={`member-${member.id}`} name="members" type="checkbox" checked={selectedMemberIds.has(member.id)} onChange={() => handleMemberSelection(member.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                                            <label htmlFor={`member-${member.id}`} className="ms-2 block text-xs font-medium text-foreground">{member.username}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {!isMultiPartyMode && entryType === 'loan' && !isSimplified && otherMembers.length > 0 && (
                                            <div className="bg-muted/40 p-3 rounded-lg animate-fadeIn border border-border/50">
                                                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-2">Paid For Me By:</label>
                                                <div className="space-y-1.5 max-h-28 overflow-y-auto px-1">
                                                    {otherMembers.filter(m => m.role !== 'observer').map((member: Member) => (
                                                        <div key={member.id} className="flex items-center">
                                                            <input
                                                                id={`loan-payer-${member.id}`}
                                                                name="loanPayer"
                                                                type="checkbox"
                                                                checked={loanPaidByUserIds.has(member.id)}
                                                                onChange={(e) => {
                                                                    const newSet = new Set(loanPaidByUserIds);
                                                                    if (e.target.checked) newSet.add(member.id);
                                                                    else newSet.delete(member.id);
                                                                    setLoanPaidByUserIds(newSet);
                                                                }}
                                                                className="h-4 w-4 rounded border-gray-300 text-success focus:ring-success"
                                                            />
                                                            <label htmlFor={`loan-payer-${member.id}`} className="ms-2 block text-xs font-medium text-foreground">{member.username}</label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-4 pt-2">
                                            <button type="submit" className="sm:col-span-2 font-bold py-2.5 px-4 rounded-lg focus:outline-none btn-primary disabled:opacity-50" disabled={isSubmitDisabled}>
                                                {t('addEntry')}
                                            </button>
                                            <Link href={`/rooms/${roomId}/entries`} className="font-bold py-2.5 px-4 rounded-lg btn-muted text-center text-xs sm:text-sm">
                                                {t('allEntries')}
                                            </Link>
                                            <Link href={`/rooms/${roomId}/stats`} className="font-bold py-2.5 px-4 rounded-lg btn-muted text-center text-xs sm:text-sm">
                                                {t('roomStatistics')}
                                            </Link>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Admin Panel Modal */}
                <AdminPanel
                    isOpen={isAdminPanelOpen}
                    onClose={() => setIsAdminPanelOpen(false)}
                    roomId={roomId}
                    roomName={roomName || ''}
                    currency={currency}
                    members={members as any}
                    currentUserId={currentUserId || 0}
                    onRefresh={() => fetchData()}
                />
            </div>
        </RoomRoleProvider>
    );
}