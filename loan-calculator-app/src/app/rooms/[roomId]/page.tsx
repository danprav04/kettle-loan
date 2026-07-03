// src/app/rooms/[roomId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { FiInfo, FiEdit, FiSave, FiX, FiLoader, FiShield, FiSliders } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { saveRoomData, getRoomData, addLocalEntry, updateLocalRoomName, LocalRoomData, Entry } from '@/lib/offline-sync';
import { useSync } from '@/components/SyncProvider';
import { PermissionProvider, Permissions, DEFAULT_PERMISSIONS } from '@/components/PermissionContext';
import AdminPanel from '@/components/AdminPanel';
import PayerBeneficiarySelector, { ShareItem, SelectorMember } from '@/components/PayerBeneficiarySelector';

interface Member {
    id: number;
    username: string;
    permissions?: { canAdmin?: boolean; canAddEntries?: boolean; canParticipate?: boolean; canView?: boolean };
}

interface RoomData {
    name: string;
    code: string;
    currency?: string;
    currentUserBalance?: number;
    currentUserPermissions?: Permissions;
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
    const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
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
    const splitsInitializedRef = useRef(false);

    const otherMembers = useMemo(() => members.filter((m: Member) => m.id !== currentUserId), [members, currentUserId]);

    const updateStateFromData = useCallback((data: LocalRoomData) => {
        setBalance(data.currentUserBalance || 0);
        setRoomCode(data.code || '');
        setRoomName(data.name || null);
        setNewName(data.name || '');
        setMembers(data.members || []);
        setCurrentUserId(data.currentUserId || null);
        if (data.currency) setCurrency(data.currency);
        if (data.currentUserPermissions) {
            setPermissions(data.currentUserPermissions);
        }
        
        const eligible = (data.members || []).filter(m => m.permissions?.canParticipate !== false);
        if (eligible.length > 0 && !splitsInitializedRef.current && data.currentUserId) {
            splitsInitializedRef.current = true;
            setPayerShares([{ userId: data.currentUserId, percentage: 100 }]);
            const count = eligible.length;
            const base = Math.floor((100 / count) * 100) / 100;
            const rem = Math.round((100 - base * count) * 100) / 100;
            setBeneficiaryShares(eligible.map((m, idx) => ({
                userId: m.id,
                percentage: idx === 0 ? Math.round((base + rem) * 100) / 100 : base
            })));

            const initialSelected = (data.members || [])
                .filter((m: Member) => m.id !== data.currentUserId && m.permissions?.canParticipate !== false)
                .map((m: Member) => m.id);
            setSelectedMemberIds(new Set(initialSelected));
            setIncludeSelfInSplit(true);
            if (initialSelected.length > 0) {
                setLoanPaidByUserIds(new Set([initialSelected[0]]));
            }
        }
    }, []);

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
                setNotification(t('percentagesMustSum100'));
                return;
            }
            finalPayerShares = payerShares;
            finalBeneficiaryShares = beneficiaryShares;
            finalSplitWithIds = beneficiaryShares.map(b => b.userId);
        } else if (entryType === 'expense') {
            const participants = new Set<number>(selectedMemberIds);
            if (includeSelfInSplit && currentUserId) participants.add(currentUserId);
            finalSplitWithIds = participants.size > 0 ? Array.from(participants) : members.filter(m => m.permissions?.canParticipate !== false).map((m: Member) => m.id);
        } else if (entryType === 'loan') {
            if (!isSimplified && loanPaidByUserIds.size > 0) {
                finalSplitWithIds = Array.from(loanPaidByUserIds);
            } else {
                const otherEligible = members.filter(m => m.permissions?.canParticipate !== false && m.id !== currentUserId).map((m: Member) => m.id);
                finalSplitWithIds = otherEligible.length > 0 ? otherEligible : (currentUserId ? [currentUserId] : []);
            }
        }

        const finalAmount = isMultiPartyMode ? parsedAmount : (entryType === 'loan' ? -parsedAmount : parsedAmount);

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
                    createdAt: optimisticEntry.created_at,
                    clientTempId: optimisticEntry.id
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
    const isViewOnly = !permissions.canAddEntries;

    return (
        <PermissionProvider permissions={permissions} currency={currency}>
            <div className="pb-16 sm:pb-6">
                {isLoading ? (
                    <div className="max-w-md mx-auto p-8 text-center text-muted-foreground animate-fadeIn">Loading room...</div>
                ) : (
                    <div className="max-w-5xl w-full mx-auto bg-card rounded-2xl shadow-xl overflow-hidden border border-card-border animate-scaleIn">
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
                                        {permissions.canAdmin && (
                                            <button onClick={handleStartEditingName} className="hidden p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit room name">
                                                <FiEdit />
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{t('roomCodeLabel', { code: roomCode })}</span>
                                    {permissions.canAdmin && (
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shadow-sm bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-purple-500/10">{t('badgeAdmin')}</span>
                                    )}
                                    {permissions.canAddEntries && (
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shadow-sm bg-blue-500/20 text-blue-400 border-blue-500/40">{t('badgeEdit')}</span>
                                    )}
                                    {permissions.canParticipate && (
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shadow-sm bg-emerald-500/20 text-emerald-400 border-emerald-500/40">{t('badgeParticipant')}</span>
                                    )}
                                    {permissions.canView && (
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shadow-sm bg-sky-500/20 text-sky-400 border-sky-500/40">{t('badgeView')}</span>
                                    )}
                                </div>

                                {permissions.canAdmin && (
                                    <button
                                        onClick={() => setIsAdminPanelOpen(true)}
                                        className="absolute right-0 top-0 px-2.5 py-1.5 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border border-purple-500/30 hover:scale-105"
                                        title="Room Administration"
                                    >
                                        <FiShield className="text-purple-400" /> <span className="hidden sm:inline">{t('adminBtn')}</span>
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
                                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2 backdrop-blur-md shadow-lg">
                                    <FiShield className="mx-auto text-amber-500 text-3xl animate-pulse" />
                                    <h3 className="font-bold text-foreground text-base">{t('viewOnlyTitle')}</h3>
                                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                                        {t('viewOnlyMsg', { role: 'member' })}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
                                        <h2 className="text-lg sm:text-xl font-semibold text-card-foreground">
                                            {isSimplified ? t('simplifiedNewEntryTitle') : t('newEntryTitle')}
                                        </h2>

                                        {!isSimplified && otherMembers.length > 0 && (
                                            <div className="flex rounded-xl bg-muted p-1 border border-border/40">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMultiPartyMode(false)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300 ${!isMultiPartyMode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {t('simpleSplit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMultiPartyMode(true)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${isMultiPartyMode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    <FiSliders className="text-[12px]" />
                                                    <span>{t('advancedSplit')}</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <form onSubmit={handleAddEntry} className="space-y-4">
                                        {!isSimplified && !isMultiPartyMode && (
                                            <div>
                                                <div className="relative flex w-full rounded-full bg-muted p-1 border border-border/40">
                                                    <span
                                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-md transition-all duration-300 ease-in-out bg-card border-2 ${entryType === 'expense' ? 'border-primary shadow-primary/10' : 'border-success shadow-success/10'}`}
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
                                                <label className="block text-muted-foreground text-xs font-bold mb-1 tracking-wide uppercase" htmlFor="amount">{t('amount')} ({currency})</label>
                                                <input id="amount" type="text" inputMode="decimal" value={amount} onFocus={(e) => e.target.select()} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value); }} className="w-full px-3 py-2 leading-tight rounded-xl themed-input font-bold text-base" required placeholder="0.00" />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="block text-muted-foreground text-xs font-bold mb-1 tracking-wide uppercase" htmlFor="description">{t('description')}</label>
                                                <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 leading-tight rounded-xl themed-input text-sm" required placeholder={t('descriptionPlaceholder')} />
                                            </div>
                                        </div>

                                        {/* Multi-Party Two List Selector */}
                                        {isMultiPartyMode && !isSimplified && (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 animate-fadeIn items-start">
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={payerShares}
                                                    onChange={setPayerShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={currency}
                                                    label={t('list1WhoPaid')}
                                                    currentUserId={currentUserId}
                                                    onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                                                />
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={beneficiaryShares}
                                                    onChange={setBeneficiaryShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={currency}
                                                    label={t('list2SplitForWhom')}
                                                    currentUserId={currentUserId}
                                                    onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                                                />
                                            </div>
                                        )}

                                        {/* Simple Split Selector */}
                                        {!isMultiPartyMode && entryType === 'expense' && !isSimplified && otherMembers.length > 0 && (
                                            <div className="bg-card/40 p-4 rounded-2xl animate-fadeIn border border-white/10 shadow-lg space-y-2.5">
                                                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t('splitWith')}</label>
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                    {currentUserId && (
                                                        <div
                                                            onClick={() => setIncludeSelfInSplit(!includeSelfInSplit)}
                                                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                                                                includeSelfInSplit ? 'bg-primary/10 border-primary/60 shadow-sm text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-border/40 text-muted-foreground'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                                                    includeSelfInSplit ? 'bg-primary border-primary text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                                                                }`}>
                                                                    {includeSelfInSplit ? '✓' : ''}
                                                                </div>
                                                                <span>{t('me')}</span>
                                                            </div>
                                                            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-bold tracking-wider">{t('youBadge')}</span>
                                                        </div>
                                                    )}
                                                    {otherMembers.filter(m => m.permissions?.canParticipate !== false).map((member: Member) => {
                                                        const isSel = selectedMemberIds.has(member.id);
                                                        return (
                                                            <div
                                                                key={member.id}
                                                                onClick={() => handleMemberSelection(member.id)}
                                                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                                                                    isSel ? 'bg-primary/10 border-primary/60 shadow-sm text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-border/40 text-muted-foreground'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                                                        isSel ? 'bg-primary border-primary text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                                                                    }`}>
                                                                        {isSel ? '✓' : ''}
                                                                    </div>
                                                                    <span>{member.username}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {!isMultiPartyMode && entryType === 'loan' && !isSimplified && otherMembers.length > 0 && (
                                            <div className="bg-card/40 p-4 rounded-2xl animate-fadeIn border border-white/10 shadow-lg space-y-2.5">
                                                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t('paidForMeBy')}</label>
                                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                    {otherMembers.filter(m => m.permissions?.canParticipate !== false).map((member: Member) => {
                                                        const isSel = loanPaidByUserIds.has(member.id);
                                                        return (
                                                            <div
                                                                key={member.id}
                                                                onClick={() => {
                                                                    const newSet = new Set(loanPaidByUserIds);
                                                                    if (isSel) newSet.delete(member.id);
                                                                    else newSet.add(member.id);
                                                                    setLoanPaidByUserIds(newSet);
                                                                }}
                                                                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                                                                    isSel ? 'bg-success/15 border-success/60 shadow-sm text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-border/40 text-muted-foreground'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                                                        isSel ? 'bg-success border-success text-white shadow-sm' : 'border-muted-foreground/40 bg-card'
                                                                    }`}>
                                                                        {isSel ? '✓' : ''}
                                                                    </div>
                                                                    <span>{member.username}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
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
        </PermissionProvider>
    );
}