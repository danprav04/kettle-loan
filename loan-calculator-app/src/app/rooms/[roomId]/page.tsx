// src/app/rooms/[roomId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSimplifiedLayout } from '@/components/SimplifiedLayoutProvider';
import { useCustomization, getLabelFontSizeStyle } from '@/components/CustomizationProvider';
import { FiInfo, FiEdit, FiSave, FiX, FiLoader, FiShield, FiSliders, FiLogOut } from 'react-icons/fi';
import { handleApi } from '@/lib/api';
import { saveRoomData, getRoomData, addLocalEntry, updateLocalRoomName, calculateAllMemberBalances, LocalRoomData, Entry } from '@/lib/offline-sync';
import { useSync } from '@/components/SyncProvider';
import { PermissionProvider, Permissions, DEFAULT_PERMISSIONS } from '@/components/PermissionContext';
import AdminPanel from '@/components/AdminPanel';
import PayerBeneficiarySelector, { ShareItem, SelectorMember } from '@/components/PayerBeneficiarySelector';
import { useSplitPresets } from '@/lib/hooks/useSplitPresets';
import CurrencyAmountInput from '@/components/CurrencyAmountInput';

interface Member {
    id: number;
    username: string;
    role?: string;
    can_participate?: boolean;
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
    const { customizations } = useCustomization();
    const { isOnline } = useSync();
    const { presets: splitPresets, savePreset, deletePreset } = useSplitPresets(roomId);

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
    const [entries, setEntries] = useState<Entry[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [inputCurrency, setInputCurrency] = useState('ILS');
    const [appendToDescription, setAppendToDescription] = useState(true);
    const [conversionInfo, setConversionInfo] = useState<{
        convertedAmount: number;
        rate: number | null;
        rateLastUpdated: number | null;
        rateIsStale: boolean;
        isRateLoading: boolean;
        isRateReady: boolean;
    }>({
        convertedAmount: 0,
        rate: 1,
        rateLastUpdated: null,
        rateIsStale: false,
        isRateLoading: false,
        isRateReady: true,
    });
    const currencyInitializedRef = useRef(false);
    const [entryType, setEntryType] = useState<'expense' | 'loan'>('expense');
    const [isMultiPartyMode, setIsMultiPartyMode] = useState(true);

    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
    const [includeSelfInSplit, setIncludeSelfInSplit] = useState(true);
    const [loanPaidByUserIds, setLoanPaidByUserIds] = useState<Set<number>>(new Set());

    // Multi-party state
    const [payerShares, setPayerShares] = useState<ShareItem[]>([]);
    const [beneficiaryShares, setBeneficiaryShares] = useState<ShareItem[]>([]);
    const splitsInitializedRef = useRef(false);

    const isMemberEligibleParticipant = (m: Member) => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined && m.can_participate === false) return false;
        if (m.permissions?.canParticipate !== undefined && m.permissions.canParticipate === false) return false;
        return true;
    };

    const otherMembers = useMemo(() => members.filter((m: Member) => m.id !== currentUserId), [members, currentUserId]);

    const updateStateFromData = useCallback((data: LocalRoomData) => {
        setBalance(data.currentUserBalance || 0);
        setRoomCode(data.code || '');
        setRoomName(data.name || null);
        setNewName(data.name || '');
        setMembers(data.members || []);
        setEntries(data.entries || []);
        setCurrentUserId(data.currentUserId || null);
        if (data.currency) {
            setCurrency(data.currency);
            if (!currencyInitializedRef.current) {
                currencyInitializedRef.current = true;
                setInputCurrency(data.currency);
            }
        }
        if (data.currentUserPermissions) {
            setPermissions(data.currentUserPermissions);
        }
        
        const eligible = (data.members || []).filter(isMemberEligibleParticipant);
        if (eligible.length > 0 && data.currentUserId) {
            const isCurrentUserEligible = (data.members || []).some(
                (m: Member) => m.id === data.currentUserId && isMemberEligibleParticipant(m)
            );
            const defaultPayerId = isCurrentUserEligible ? data.currentUserId : eligible[0].id;

            if (!splitsInitializedRef.current) {
                splitsInitializedRef.current = true;
                setPayerShares([{ userId: defaultPayerId, percentage: 100 }]);
                const count = eligible.length;
                const base = Math.floor((100 / count) * 1e6) / 1e6;
                const rem = Math.round((100 - base * count) * 1e6) / 1e6;
                setBeneficiaryShares(eligible.map((m, idx) => ({
                    userId: m.id,
                    percentage: idx === 0 ? Math.round((base + rem) * 1e6) / 1e6 : base
                })));

                const initialSelected = (data.members || [])
                    .filter((m: Member) => m.id !== data.currentUserId && isMemberEligibleParticipant(m))
                    .map((m: Member) => m.id);
                setSelectedMemberIds(new Set(initialSelected));
                setIncludeSelfInSplit(isCurrentUserEligible);
                if (initialSelected.length > 0) {
                    setLoanPaidByUserIds(new Set([initialSelected[0]]));
                } else if (isCurrentUserEligible) {
                    setLoanPaidByUserIds(new Set([data.currentUserId]));
                } else if (eligible.length > 0) {
                    setLoanPaidByUserIds(new Set([eligible[0].id]));
                }
            } else {
                setPayerShares(prev => {
                    const valid = prev.filter(s => {
                        const m = (data.members || []).find(mem => mem.id === s.userId);
                        return m && isMemberEligibleParticipant(m);
                    });
                    return valid.length > 0 ? valid : [{ userId: defaultPayerId, percentage: 100 }];
                });
                setBeneficiaryShares(prev => {
                    const valid = prev.filter(s => {
                        const m = (data.members || []).find(mem => mem.id === s.userId);
                        return m && isMemberEligibleParticipant(m);
                    });
                    return valid.length > 0 ? valid : eligible.map((m, idx) => {
                        const count = eligible.length;
                        const base = Math.floor((100 / count) * 1e6) / 1e6;
                        const rem = Math.round((100 - base * count) * 1e6) / 1e6;
                        return { userId: m.id, percentage: idx === 0 ? Math.round((base + rem) * 1e6) / 1e6 : base };
                    });
                });
                setSelectedMemberIds(prev => {
                    const next = new Set<number>();
                    prev.forEach(id => {
                        const m = (data.members || []).find(mem => mem.id === id);
                        if (m && isMemberEligibleParticipant(m)) next.add(id);
                    });
                    return next;
                });
                setIncludeSelfInSplit(prev => prev && isCurrentUserEligible);
                setLoanPaidByUserIds(prev => {
                    const next = new Set<number>();
                    prev.forEach(id => {
                        const m = (data.members || []).find(mem => mem.id === id);
                        if (m && isMemberEligibleParticipant(m)) next.add(id);
                    });
                    return next.size > 0 ? next : new Set([defaultPayerId]);
                });
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

    const handleLeaveRoom = async () => {
        if (Math.abs(balance) > 0.01) {
            setNotification(t('leaveRoomNonZeroBalance'));
            return;
        }

        if (permissions.canAdmin) {
            const adminCount = members.filter(m => m.permissions?.canAdmin).length;
            const activeUserCount = members.filter(m => m.permissions?.canView).length;
            if (adminCount <= 1 && activeUserCount > 1) {
                setNotification(t('leaveRoomLastAdmin'));
                return;
            }
        }

        if (confirm(t('leaveRoomConfirm'))) {
            setIsLoading(true);
            try {
                await handleApi({
                    method: 'DELETE',
                    url: `/api/rooms/${roomId}/members`
                });
                router.push('/');
            } catch (err: any) {
                setNotification(err.message || t('leaveRoomFailed'));
                setIsLoading(false);
            }
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

        const isDifferentCurrency = inputCurrency.toUpperCase() !== currency.toUpperCase();
        if (isDifferentCurrency) {
            if (conversionInfo.isRateLoading) {
                setNotification(t('rateNotAvailableError'));
                return;
            }
            if (!conversionInfo.rate) {
                setNotification(t('rateUnavailable'));
                return;
            }
        }

        const convertedAmount = isDifferentCurrency && conversionInfo.rate
            ? Math.round(parsedAmount * conversionInfo.rate * 100) / 100
            : parsedAmount;

        let finalDescription = description;
        if (isDifferentCurrency && appendToDescription && conversionInfo.rate) {
            finalDescription = `${description} (${parsedAmount.toFixed(2)} ${inputCurrency} @ ${conversionInfo.rate})`;
        }

        let finalSplitWithIds: number[] | null = null;
        let finalPayerShares: ShareItem[] | null = null;
        let finalBeneficiaryShares: ShareItem[] | null = null;

        if (isMultiPartyMode) {
            const sumP = payerShares.reduce((a, b) => a + b.percentage, 0);
            const sumB = beneficiaryShares.reduce((a, b) => a + b.percentage, 0);
            if (customizations.coreEnforceSumValidation !== false && (Math.abs(sumP - 100) > 0.1 || Math.abs(sumB - 100) > 0.1)) {
                setNotification(t('percentagesMustSum100'));
                return;
            }
            finalPayerShares = payerShares;
            finalBeneficiaryShares = beneficiaryShares;
            finalSplitWithIds = beneficiaryShares.map(b => b.userId);
        } else if (entryType === 'expense') {
            const participants = new Set<number>(selectedMemberIds);
            if (includeSelfInSplit && currentUserId) participants.add(currentUserId);
            finalSplitWithIds = participants.size > 0 ? Array.from(participants) : members.filter(isMemberEligibleParticipant).map((m: Member) => m.id);
        } else if (entryType === 'loan') {
            if (!isSimplified && loanPaidByUserIds.size > 0) {
                finalSplitWithIds = Array.from(loanPaidByUserIds);
            } else {
                const otherEligible = members.filter(m => isMemberEligibleParticipant(m) && m.id !== currentUserId).map((m: Member) => m.id);
                finalSplitWithIds = otherEligible.length > 0 ? otherEligible : (currentUserId ? [currentUserId] : []);
            }
        }

        const finalAmount = isMultiPartyMode ? convertedAmount : (entryType === 'loan' ? -convertedAmount : convertedAmount);

        const optimisticEntry: Entry = {
            id: `temp-${Date.now()}`,
            amount: finalAmount.toFixed(2),
            description: finalDescription,
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
                    description: finalDescription, 
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

    const isDifferentCurrency = inputCurrency.toUpperCase() !== currency.toUpperCase();
    const isSubmitDisabled = amount === '' || description === '' || (isDifferentCurrency && !conversionInfo.isRateReady);
    const isViewOnly = !permissions.canAddEntries;

    return (
        <PermissionProvider permissions={permissions} currency={currency}>
            <div className="pb-8 sm:pb-4">
                {isLoading ? (
                    <div className="max-w-md mx-auto p-8 text-center text-muted-foreground animate-fadeIn">Loading room...</div>
                ) : (
                    <div className="max-w-5xl w-full mx-auto bg-card rounded-2xl shadow-xl overflow-hidden border border-card-border animate-scaleIn">
                        <div className="p-3 sm:p-4 md:p-5">
                            {/* Desktop Header & Balance Bar */}
                            <div className="hidden md:flex md:items-center md:justify-between md:gap-4 mb-3 pb-3 border-b border-card-border">
                                {/* Left: Leave button + Room Title + Badges */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        onClick={handleLeaveRoom}
                                        className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-red-500/20 shrink-0"
                                        title={t('leaveRoomTitle')}
                                    >
                                        <FiLogOut /> <span>{t('leaveBtn')}</span>
                                    </button>

                                    <div className="min-w-0">
                                        {isEditingName ? (
                                            <div className="flex items-center space-x-2 rtl:space-x-reverse animate-fadeIn">
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    className="px-2.5 py-1 text-base font-bold rounded-lg themed-input"
                                                    autoFocus
                                                    onKeyDown={(e) => { e.key === 'Enter' && handleSaveName(); }}
                                                />
                                                <button onClick={handleSaveName} className="p-1.5 btn-primary rounded-lg" disabled={isSavingName} aria-label="Save name">
                                                    {isSavingName ? <FiLoader className="animate-spin" /> : <FiSave />}
                                                </button>
                                                <button onClick={() => setIsEditingName(false)} className="p-1.5 btn-muted rounded-lg" aria-label="Cancel editing name">
                                                    <FiX />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group">
                                                <h1 className="text-lg lg:text-xl font-bold font-heading text-card-foreground truncate">
                                                    {roomName || t('roomTitle', { code: roomCode })}
                                                </h1>
                                                {permissions.canAdmin && (
                                                    <button onClick={handleStartEditingName} className="p-1 text-muted-foreground hover:text-primary transition-opacity" aria-label="Edit room name">
                                                        <FiEdit size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground">{t('roomCodeLabel', { code: roomCode })}</span>
                                            {permissions.canAdmin && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">{t('badgeAdmin')}</span>
                                            )}
                                            {permissions.canAddEntries && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30">{t('badgeEdit')}</span>
                                            )}
                                            {permissions.canParticipate && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('badgeParticipant')}</span>
                                            )}
                                            {permissions.canView && (
                                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-full border bg-sky-500/20 text-sky-400 border-sky-500/30">{t('badgeView')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Balance + Action buttons */}
                                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                                    {customizations.coreBalanceDisplay !== false && (
                                        <div className="flex items-center gap-3 bg-muted/50 dark:bg-zinc-900/60 px-3 py-1.5 rounded-xl border border-card-border shadow-xs">
                                            <div className="text-right">
                                                <div
                                                    className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight"
                                                    style={getLabelFontSizeStyle(customizations.balanceTitleLabelFontSize)}
                                                >
                                                    {customizations.balanceTitleLabel?.trim() || t('balanceTitle')}
                                                </div>
                                                <div className={`text-lg lg:text-xl font-black font-mono leading-tight ${balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                                    {balance.toFixed(0)} {currency}
                                                </div>
                                            </div>
                                            {customizations.detailedBalance && (
                                                <Link
                                                    href={`/rooms/${roomId}/balance`}
                                                    className="text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-md bg-primary/10 border border-primary/20 transition-all shrink-0"
                                                    style={getLabelFontSizeStyle(customizations.detailedBalanceLabelFontSize)}
                                                >
                                                    {customizations.detailedBalanceLabel?.trim() || t('detailed')} →
                                                </Link>
                                            )}
                                        </div>
                                    )}

                                    <Link
                                        href={`/rooms/${roomId}/entries`}
                                        className="font-bold py-1.5 px-3 rounded-xl btn-muted border border-card-border hover:border-muted-foreground text-xs shadow-xs"
                                        style={getLabelFontSizeStyle(customizations.allEntriesButtonLabelFontSize)}
                                    >
                                        {customizations.allEntriesButtonLabel?.trim() || t('allEntries')}
                                    </Link>
                                    {customizations.roomStats && (
                                        <Link
                                            href={`/rooms/${roomId}/stats`}
                                            className="font-bold py-1.5 px-3 rounded-xl btn-muted border border-card-border hover:border-muted-foreground text-xs shadow-xs"
                                            style={getLabelFontSizeStyle(customizations.roomStatsButtonLabelFontSize)}
                                        >
                                            {customizations.roomStatsButtonLabel?.trim() || t('roomStatistics')}
                                        </Link>
                                    )}
                                    {permissions.canAdmin && (
                                        <button
                                            onClick={() => setIsAdminPanelOpen(true)}
                                            className="px-2.5 py-1.5 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs border border-purple-500/30"
                                            title={t('adminTitle')}
                                        >
                                            <FiShield className="text-purple-600 dark:text-purple-400" /> <span>{t('adminBtn')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Header & Balance (stacked, clean) */}
                            <div className="md:hidden">
                                <div className="text-center mb-3 relative">
                                    {isEditingName ? (
                                        <div className="flex items-center space-x-2 rtl:space-x-reverse animate-fadeIn">
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="w-full px-3 py-1 text-lg font-bold text-center rounded-lg themed-input"
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
                                            <h1 className="text-lg font-bold font-heading text-card-foreground">
                                                {roomName || t('roomTitle', { code: roomCode })}
                                            </h1>
                                            {permissions.canAdmin && (
                                                <button onClick={handleStartEditingName} className="p-1 text-muted-foreground hover:text-primary transition-opacity" aria-label="Edit room name">
                                                    <FiEdit size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                                        <span className="text-xs text-muted-foreground">{t('roomCodeLabel', { code: roomCode })}</span>
                                        {permissions.canAdmin && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">{t('badgeAdmin')}</span>
                                        )}
                                        {permissions.canAddEntries && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30">{t('badgeEdit')}</span>
                                        )}
                                        {permissions.canParticipate && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('badgeParticipant')}</span>
                                        )}
                                        {permissions.canView && (
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border bg-sky-500/20 text-sky-400 border-sky-500/30">{t('badgeView')}</span>
                                        )}
                                    </div>

                                    {permissions.canAdmin && (
                                        <button
                                            onClick={() => setIsAdminPanelOpen(true)}
                                            className="absolute right-0 top-0 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border border-purple-500/30"
                                            title={t('adminTitle')}
                                        >
                                            <FiShield className="text-purple-600 dark:text-purple-400" />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleLeaveRoom}
                                        className="absolute left-0 top-0 px-2 py-1 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border border-red-500/20"
                                        title={t('leaveRoomTitle')}
                                    >
                                        <FiLogOut />
                                    </button>
                                </div>

                                {customizations.coreBalanceDisplay !== false && (
                                    <div className="text-center my-3 p-3.5 rounded-xl bg-muted/40 dark:bg-zinc-900/60 border border-card-border shadow-xs">
                                        <div
                                            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                                            style={getLabelFontSizeStyle(customizations.balanceTitleLabelFontSize)}
                                        >
                                            {customizations.balanceTitleLabel?.trim() || t('balanceTitle')}
                                        </div>
                                        <div className={`text-3xl font-black font-mono mt-0.5 ${balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                            {balance.toFixed(0)} {currency}
                                        </div>
                                        {customizations.detailedBalance && (
                                            <Link
                                                href={`/rooms/${roomId}/balance`}
                                                className="text-xs font-semibold text-primary hover:underline inline-flex items-center justify-center mx-auto mt-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 transition-all"
                                                style={getLabelFontSizeStyle(customizations.detailedBalanceLabelFontSize)}
                                            >
                                                {customizations.detailedBalanceLabel?.trim() || t('detailed')} →
                                            </Link>
                                        )}
                                    </div>
                                )}

                                <div className="border-t border-card-border my-3"></div>
                            </div>

                            {/* Notifications */}
                            {notification && (
                                <div className="mb-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-800 flex items-center animate-fadeIn">
                                    <FiInfo className="me-2 shrink-0"/>
                                    <span>{notification}</span>
                                </div>
                            )}

                            {/* Entry Form or View-Only Alert */}
                            {isViewOnly ? (
                                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2 backdrop-blur-md shadow-lg mb-4">
                                    <FiShield className="mx-auto text-amber-500 text-3xl animate-pulse" />
                                    <h3 className="font-bold text-foreground text-base">{t('viewOnlyTitle')}</h3>
                                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                                        {t('viewOnlyMsg', { role: 'member' })}
                                    </p>
                                </div>
                            ) : (
                                <div className="mb-2 sm:mb-3">
                                    <div className="flex items-center justify-between mb-2 sm:mb-2.5 gap-2 flex-wrap">
                                        <h2
                                            className="text-base sm:text-lg font-bold font-heading text-card-foreground"
                                            style={getLabelFontSizeStyle(customizations.newEntryTitleLabelFontSize)}
                                        >
                                            {customizations.newEntryTitleLabel?.trim() || (isSimplified ? t('simplifiedNewEntryTitle') : t('newEntryTitle'))}
                                        </h2>

                                        {!isSimplified && otherMembers.length > 0 && (
                                            <div style={{ display: 'none' }} className="flex rounded-xl bg-muted p-1 border border-card-border">
                                                <button
                                                    type="button"
                                                    style={{ display: 'none' }}
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

                                    <form onSubmit={handleAddEntry} className="space-y-3">
                                        {!isSimplified && !isMultiPartyMode && (
                                            <div style={{ display: 'none' }}>
                                                <div className="relative flex w-full rounded-full bg-muted p-1 border border-card-border">
                                                    <span
                                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-md transition-all duration-300 ease-in-out bg-card border ${entryType === 'expense' ? 'border-primary' : 'border-success'}`}
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
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            <div className="sm:col-span-1">
                                                <CurrencyAmountInput
                                                    id="amount"
                                                    amount={amount}
                                                    onAmountChange={setAmount}
                                                    roomCurrency={currency}
                                                    inputCurrency={inputCurrency}
                                                    onInputCurrencyChange={setInputCurrency}
                                                    appendToDescription={appendToDescription}
                                                    onAppendToDescriptionChange={setAppendToDescription}
                                                    onConversionChange={setConversionInfo}
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label
                                                    className="block text-foreground dark:text-zinc-200 text-xs sm:text-sm font-bold mb-1 tracking-wider uppercase"
                                                    htmlFor="description"
                                                    style={getLabelFontSizeStyle(customizations.descriptionInputLabelFontSize)}
                                                >
                                                    {customizations.descriptionInputLabel?.trim() || t('description')}
                                                </label>
                                                <input
                                                    id="description"
                                                    type="text"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="w-full px-3 py-2 leading-tight rounded-xl themed-input text-sm font-semibold"
                                                    style={getLabelFontSizeStyle(customizations.descriptionPlaceholderLabelFontSize)}
                                                    required
                                                    placeholder={customizations.descriptionPlaceholderLabel?.trim() || t('descriptionPlaceholder')}
                                                />
                                            </div>
                                        </div>

                                        {/* Multi-Party Two List Selector */}
                                        {isMultiPartyMode && !isSimplified && (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1 animate-fadeIn items-start">
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={payerShares}
                                                    onChange={setPayerShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={inputCurrency}
                                                    label={customizations.payerListLabel?.trim() || t('list1WhoPaid')}
                                                    labelFontSize={customizations.payerListLabelFontSize}
                                                    currentUserId={currentUserId}
                                                    onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                                                    presets={splitPresets}
                                                    onSavePreset={savePreset}
                                                    onDeletePreset={deletePreset}
                                                />
                                                <PayerBeneficiarySelector
                                                    members={members}
                                                    shares={beneficiaryShares}
                                                    onChange={setBeneficiaryShares}
                                                    totalAmount={parseFloat(amount) || 0}
                                                    currency={inputCurrency}
                                                    label={customizations.beneficiaryListLabel?.trim() || t('list2SplitForWhom')}
                                                    labelFontSize={customizations.beneficiaryListLabelFontSize}
                                                    currentUserId={currentUserId}
                                                    onUpdateTotal={(newTotal) => setAmount(newTotal.toString())}
                                                    presets={splitPresets}
                                                    onSavePreset={savePreset}
                                                    onDeletePreset={deletePreset}
                                                />
                                            </div>
                                        )}

                                        {/* Simple Split Selector */}
                                        {!isMultiPartyMode && entryType === 'expense' && !isSimplified && otherMembers.length > 0 && (
                                            <div style={{ display: 'none' }} className="bg-card/40 p-3 rounded-2xl animate-fadeIn border border-card-border shadow-md space-y-2">
                                                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t('splitWith')}</label>
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                    {currentUserId && isMemberEligibleParticipant(members.find(m => m.id === currentUserId) || { id: -1, username: '' }) && (
                                                         <div
                                                             onClick={() => setIncludeSelfInSplit(!includeSelfInSplit)}
                                                             className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                                                                 includeSelfInSplit ? 'bg-primary/10 border-primary/50 shadow-xs text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-card-border text-muted-foreground'
                                                             }`}
                                                         >
                                                             <div className="flex items-center gap-2.5">
                                                                 <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold border transition-colors ${
                                                                     includeSelfInSplit ? 'bg-primary border-primary text-white shadow-xs' : 'border-card-border bg-card'
                                                                 }`}>
                                                                     {includeSelfInSplit ? '✓' : ''}
                                                                 </div>
                                                                 <span className="text-xs sm:text-sm font-semibold text-foreground">{t('me')}</span>
                                                             </div>
                                                             <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md font-bold tracking-wider">{t('youBadge')}</span>
                                                         </div>
                                                     )}
                                                     {otherMembers.filter(isMemberEligibleParticipant).map((member: Member) => {
                                                         const isSel = selectedMemberIds.has(member.id);
                                                         return (
                                                             <div
                                                                 key={member.id}
                                                                 onClick={() => handleMemberSelection(member.id)}
                                                                 className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all select-none cursor-pointer ${
                                                                     isSel ? 'bg-primary/10 border-primary/50 shadow-xs text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-card-border text-muted-foreground'
                                                                 }`}
                                                             >
                                                                 <div className="flex items-center gap-2.5">
                                                                     <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold border transition-colors ${
                                                                         isSel ? 'bg-primary border-primary text-white shadow-xs' : 'border-card-border bg-card'
                                                                     }`}>
                                                                         {isSel ? '✓' : ''}
                                                                     </div>
                                                                     <span className="text-xs sm:text-sm font-semibold text-foreground">{member.username}</span>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })}
                                                </div>
                                            </div>
                                        )}

                                        {!isMultiPartyMode && entryType === 'loan' && !isSimplified && otherMembers.length > 0 && (
                                            <div style={{ display: 'none' }} className="bg-card/40 p-3 rounded-2xl animate-fadeIn border border-card-border shadow-md space-y-2">
                                                <label className="text-xs font-bold text-foreground uppercase tracking-wider block">{t('paidForMeBy')}</label>
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                    {otherMembers.filter(isMemberEligibleParticipant).map((member: Member) => {
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
                                                                    isSel ? 'bg-success/15 border-success/50 shadow-xs text-foreground font-semibold' : 'bg-background/40 hover:bg-muted/40 border-card-border text-muted-foreground'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold border transition-colors ${
                                                                        isSel ? 'bg-success border-success text-white shadow-xs' : 'border-card-border bg-card'
                                                                    }`}>
                                                                        {isSel ? '✓' : ''}
                                                                    </div>
                                                                    <span className="text-xs sm:text-sm font-semibold text-foreground">{member.username}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-1.5">
                                            <button
                                                type="submit"
                                                className="w-full text-sm font-bold py-2.5 sm:py-3 px-4 rounded-xl focus:outline-none btn-primary shadow-sm disabled:opacity-55 disabled:cursor-not-allowed"
                                                style={getLabelFontSizeStyle(customizations.addEntryButtonLabelFontSize)}
                                                disabled={isSubmitDisabled}
                                            >
                                                {customizations.addEntryButtonLabel?.trim() || t('addEntry')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className={`flex flex-col ${customizations.roomStats ? 'sm:grid sm:grid-cols-2' : ''} gap-2 sm:gap-3 mt-2 sm:mt-2.5`}>
                                <Link
                                    href={`/rooms/${roomId}/entries`}
                                    className="font-bold py-2 sm:py-2.5 px-4 rounded-xl btn-muted border border-card-border hover:border-muted-foreground text-center text-xs sm:text-sm shadow-xs"
                                    style={getLabelFontSizeStyle(customizations.allEntriesButtonLabelFontSize)}
                                >
                                    {customizations.allEntriesButtonLabel?.trim() || t('allEntries')}
                                </Link>
                                {customizations.roomStats && (
                                    <Link
                                        href={`/rooms/${roomId}/stats`}
                                        className="font-bold py-2 sm:py-2.5 px-4 rounded-xl btn-muted border border-card-border hover:border-muted-foreground text-center text-xs sm:text-sm shadow-xs"
                                        style={getLabelFontSizeStyle(customizations.roomStatsButtonLabelFontSize)}
                                    >
                                        {customizations.roomStatsButtonLabel?.trim() || t('roomStatistics')}
                                    </Link>
                                )}
                            </div>
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
                    memberBalances={calculateAllMemberBalances(entries, members as any)}
                />
            </div>
        </PermissionProvider>
    );
}