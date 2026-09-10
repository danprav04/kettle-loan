// src/lib/stats-calc.ts
import { calculateAllMemberBalances, BalanceCalcMember, BalanceCalcEntry } from './balance-calc';
import { Entry } from './offline-sync';

export interface StatsMember {
    id: number;
    username: string;
    role?: string;
    can_participate?: boolean;
    permissions?: {
        canAdmin?: boolean;
        canAddEntries?: boolean;
        canParticipate?: boolean;
        canView?: boolean;
    };
}

export interface MemberContribution {
    userId: number;
    username: string;
    paid: number;
    share: number;
    settled: number;
    net: number;
    paidPercentage: number;
    sharePercentage: number;
    isEligible: boolean;
}

export interface RoomStatsResult {
    totalExpenses: number;
    totalLoans: number;
    totalSettlements: number;
    totalEntries: number;
    biggestExpense: { description: string; amount: number } | null;
    averageExpensePerMember: number;
    memberContributions: Map<number, MemberContribution>;
}

export function sanitizeZero(val: number): number {
    if (Math.abs(val) < 0.005) return 0;
    return val;
}

export function formatCurrencyAmount(val: number): string {
    const cleanVal = sanitizeZero(val);
    const rounded = Math.round(cleanVal * 100) / 100;
    const isWhole = Number.isInteger(rounded);
    return rounded.toLocaleString(undefined, {
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: 2,
    });
}

export function isSettlementEntry(entry: { description?: string | null }): boolean {
    if (!entry.description) return false;
    const desc = entry.description.toLowerCase().trim();
    const settlementKeywords = [
        'settle',
        'repayment',
        'погашен',
        'расчет',
        'расчёт',
        'סגירת חוב',
        'סגור חוב',
        'התחשב'
    ];
    return settlementKeywords.some(kw => desc.includes(kw));
}

export function calculateRoomStats(
    entries: Entry[],
    members: StatsMember[]
): RoomStatsResult | null {
    if (!entries || entries.length === 0 || !members || members.length === 0) {
        return null;
    }

    const calcMembers = members.filter(m => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined) return m.can_participate !== false;
        if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
        return true;
    });

    const memberContributions = new Map<number, MemberContribution>();
    members.forEach(m => {
        const isEligible = calcMembers.some(cm => cm.id === m.id);
        memberContributions.set(m.id, {
            userId: m.id,
            username: m.username,
            paid: 0,
            share: 0,
            settled: 0,
            net: 0,
            paidPercentage: 0,
            sharePercentage: 0,
            isEligible
        });
    });

    let totalExpenses = 0;
    let totalLoans = 0;
    let totalSettlements = 0;
    let biggestExpense: { description: string; amount: number } | null = null;

    for (const entry of entries) {
        const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
        if (isNaN(amount)) continue;

        const isSettlement = isSettlementEntry(entry);
        const hasExplicitShares = Boolean(
            entry.payer_shares &&
            entry.beneficiary_shares &&
            Array.isArray(entry.payer_shares) &&
            Array.isArray(entry.beneficiary_shares) &&
            entry.payer_shares.length > 0 &&
            entry.beneficiary_shares.length > 0
        );

        if (isSettlement) {
            const settlementAmount = Math.abs(amount);
            totalSettlements += settlementAmount;

            if (hasExplicitShares) {
                entry.payer_shares!.forEach(p => {
                    const pData = memberContributions.get(p.userId);
                    if (pData) pData.settled += settlementAmount * (Number(p.percentage) / 100);
                });
                entry.beneficiary_shares!.forEach(b => {
                    const bData = memberContributions.get(b.userId);
                    if (bData) bData.settled -= settlementAmount * (Number(b.percentage) / 100);
                });
            } else {
                const payerData = memberContributions.get(entry.user_id);
                if (payerData) payerData.settled += settlementAmount;

                const participants = entry.split_with_user_ids || [];
                if (participants.length > 0) {
                    const perRecipient = settlementAmount / participants.length;
                    participants.forEach(recipientId => {
                        const rData = memberContributions.get(recipientId);
                        if (rData) rData.settled -= perRecipient;
                    });
                }
            }
            continue;
        }

        if (hasExplicitShares) {
            if (amount > 0) {
                totalExpenses += amount;
                if (!biggestExpense || amount > biggestExpense.amount) {
                    biggestExpense = { description: entry.description, amount };
                }

                entry.payer_shares!.forEach(p => {
                    const pData = memberContributions.get(p.userId);
                    if (pData) pData.paid += amount * (Number(p.percentage) / 100);
                });
                entry.beneficiary_shares!.forEach(b => {
                    const bData = memberContributions.get(b.userId);
                    if (bData) bData.share += amount * (Number(b.percentage) / 100);
                });
            } else if (amount < 0) {
                const loanAmount = Math.abs(amount);
                totalLoans += loanAmount;

                // In a negative amount entry with shares, payer_shares represent borrower(s)
                // and beneficiary_shares represent lender(s) who provided funds.
                entry.payer_shares!.forEach(p => {
                    const pData = memberContributions.get(p.userId);
                    if (pData) pData.share += loanAmount * (Number(p.percentage) / 100);
                });
                entry.beneficiary_shares!.forEach(b => {
                    const bData = memberContributions.get(b.userId);
                    if (bData) bData.paid += loanAmount * (Number(b.percentage) / 100);
                });
            }
            continue;
        }

        // Legacy format without explicit shares
        const payerId = entry.user_id;

        if (amount > 0) {
            totalExpenses += amount;
            if (!biggestExpense || amount > biggestExpense.amount) {
                biggestExpense = { description: entry.description, amount };
            }

            const payerData = memberContributions.get(payerId);
            if (payerData) payerData.paid += amount;

            const participants = entry.split_with_user_ids;
            const activeParticipants = participants && participants.length > 0
                ? members.filter(m => participants.includes(m.id))
                : (participants === null || participants === undefined ? calcMembers : []);

            if (activeParticipants.length > 0) {
                const share = amount / activeParticipants.length;
                activeParticipants.forEach(p => {
                    const pData = memberContributions.get(p.id);
                    if (pData) pData.share += share;
                });
            }
        } else if (amount < 0) {
            const loanAmount = Math.abs(amount);
            totalLoans += loanAmount;

            const borrowerData = memberContributions.get(payerId);
            if (borrowerData) borrowerData.share += loanAmount;

            const participants = entry.split_with_user_ids;
            const lenders = participants && participants.length > 0
                ? members.filter(m => participants.includes(m.id))
                : (participants === null || participants === undefined ? calcMembers.filter(m => m.id !== payerId) : []);

            if (lenders.length > 0) {
                const creditPerLender = loanAmount / lenders.length;
                lenders.forEach(lender => {
                    const lenderData = memberContributions.get(lender.id);
                    if (lenderData) lenderData.paid += creditPerLender;
                });
            }
        }
    }

    // Canonical net balances from shared balance-calc engine
    const canonicalBalances = calculateAllMemberBalances(
        entries as BalanceCalcEntry[],
        members as BalanceCalcMember[]
    );

    totalExpenses = sanitizeZero(Math.round(totalExpenses * 100) / 100);
    totalLoans = sanitizeZero(Math.round(totalLoans * 100) / 100);
    totalSettlements = sanitizeZero(Math.round(totalSettlements * 100) / 100);

    const eligibleCount = calcMembers.length > 0 ? calcMembers.length : members.length;
    const averageExpensePerMember = sanitizeZero(Math.round((totalExpenses / eligibleCount) * 100) / 100);

    memberContributions.forEach((data, userId) => {
        data.paid = sanitizeZero(Math.round(data.paid * 100) / 100);
        data.share = sanitizeZero(Math.round(data.share * 100) / 100);
        data.settled = sanitizeZero(Math.round(data.settled * 100) / 100);
        data.net = sanitizeZero(Math.round((canonicalBalances[userId] ?? 0) * 100) / 100);

        if (totalExpenses > 0) {
            data.paidPercentage = Math.round((data.paid / totalExpenses) * 1000) / 10;
            data.sharePercentage = Math.round((data.share / totalExpenses) * 1000) / 10;
        } else {
            data.paidPercentage = 0;
            data.sharePercentage = 0;
        }
    });

    return {
        totalExpenses,
        totalLoans,
        totalSettlements,
        totalEntries: entries.length,
        biggestExpense,
        averageExpensePerMember,
        memberContributions
    };
}
