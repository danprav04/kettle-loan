// src/lib/entry-formatting.tsx
import React from 'react';
import { Entry } from './offline-sync';

interface Member {
    id: number;
    username: string;
    permissions?: { canAdmin?: boolean; canAddEntries?: boolean; canParticipate?: boolean; canView?: boolean };
}

interface User {
    userId: number;
    username: string;
}

export const getEntryDetails = (
    entry: Entry,
    memberMap: Map<number, string>,
    allMembers: Member[],
    currentUser: User | null,
    t: (key: string, values?: Record<string, string | number>) => string
): React.ReactNode => {
    const amount = parseFloat(entry.amount);
    const actorUsername = entry.username;

    const formatPercentage = (pct: number) => {
        return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
    };

    let payersText = '';
    if (entry.payer_shares && Array.isArray(entry.payer_shares) && entry.payer_shares.length > 0) {
        payersText = entry.payer_shares.map(p => {
            const name = p.userId === currentUser?.userId ? t('entryParticipantYou') : (memberMap.get(p.userId) || `ID:${p.userId}`);
            return `${name} (${formatPercentage(Number(p.percentage))})`;
        }).join(', ');
    } else {
        payersText = entry.user_id === currentUser?.userId ? t('entryParticipantYou') : (memberMap.get(entry.user_id) || actorUsername);
    }

    let participantsText = '';
    if (entry.beneficiary_shares && Array.isArray(entry.beneficiary_shares) && entry.beneficiary_shares.length > 0) {
        participantsText = entry.beneficiary_shares.map(b => {
            const name = b.userId === currentUser?.userId ? t('entryParticipantYou') : (memberMap.get(b.userId) || `ID:${b.userId}`);
            return `${name} (${formatPercentage(Number(b.percentage))})`;
        }).join(', ');
    } else {
        const participants = entry.split_with_user_ids || [];
        const calcMembersCount = allMembers.filter(m => m.permissions?.canParticipate !== false).length || allMembers.length;
        const isForAll = participants.length > 0 && participants.length === calcMembersCount;

        if (isForAll) {
            participantsText = t('entryParticipantEveryone');
        } else if (participants.length > 0) {
            participantsText = participants.map(id => {
                if (id === currentUser?.userId) return t('entryParticipantYou');
                return memberMap.get(id) || `ID:${id}`;
            }).join(', ');
        } else {
            participantsText = t('entryParticipantEveryone');
        }
    }

    if (amount < 0 && (!entry.payer_shares || entry.payer_shares.length === 0) && (!entry.beneficiary_shares || entry.beneficiary_shares.length === 0)) {
        // Loan without explicit share structure
        const borrowerText = entry.user_id === currentUser?.userId ? t('entryParticipantYou') : actorUsername;
        return (
            <>
                <span>{t('entryLoanTo', { borrower: borrowerText })}</span>
                <span className="mx-1.5">&bull;</span>
                <span>{t('entryFromGroup')}</span>
            </>
        );
    }

    return (
        <>
            <span>{t('entryPaidBy', { payer: payersText })}</span>
            <span className="mx-1.5">&bull;</span>
            <span>{t('entryFor', { participants: participantsText })}</span>
        </>
    );
};
