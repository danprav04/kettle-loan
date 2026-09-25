// src/lib/balance-calc.ts

export interface BalanceCalcMember {
    id: number;
    username?: string;
    role?: string;
    can_participate?: boolean;
    permissions?: {
        canParticipate?: boolean;
    };
}

export interface Share {
    userId: number;
    percentage: number;
}

export interface BalanceCalcEntry {
    amount: string | number;
    user_id: number;
    split_with_user_ids?: number[] | null;
    payer_shares?: Share[] | null;
    beneficiary_shares?: Share[] | null;
    created_at?: string;
    [key: string]: any;
}

export const calculateAllMemberBalances = (
    entries: BalanceCalcEntry[],
    members: BalanceCalcMember[]
): { [userId: number]: number } => {
    const finalBalances: { [userId: number]: number } = {};
    members.forEach(member => {
        finalBalances[member.id] = 0;
    });

    const calcMembers = members.filter(m => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined) return m.can_participate !== false;
        if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
        return true;
    });

    entries.forEach(entry => {
        const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;

        if (entry.payer_shares && entry.beneficiary_shares && Array.isArray(entry.payer_shares) && Array.isArray(entry.beneficiary_shares)) {
            entry.payer_shares.forEach(p => {
                if (finalBalances[p.userId] !== undefined) {
                    finalBalances[p.userId] += amount * (p.percentage / 100);
                }
            });
            entry.beneficiary_shares.forEach(b => {
                if (finalBalances[b.userId] !== undefined) {
                    finalBalances[b.userId] -= amount * (b.percentage / 100);
                }
            });
            return;
        }

        const payerId = entry.user_id;

        if (amount > 0) { // Expense
            const participants = entry.split_with_user_ids;
            const activeParticipants = participants && participants.length > 0
                ? members.filter(m => participants.includes(m.id))
                : (participants === null || participants === undefined ? calcMembers : []);

            if (activeParticipants.length > 0) {
                const numParticipants = activeParticipants.length;
                const share = amount / numParticipants;
                finalBalances[payerId] += amount;
                activeParticipants.forEach(p => {
                    if (finalBalances[p.id] !== undefined) {
                        finalBalances[p.id] -= share;
                    }
                });
            }
        } else if (amount < 0) { // Loan
            const loanAmount = Math.abs(amount);
            const borrowerId = payerId;

            const participants = entry.split_with_user_ids;
            const lenders = participants && participants.length > 0
                ? members.filter(m => participants.includes(m.id))
                : (participants === null || participants === undefined ? calcMembers.filter(m => m.id !== borrowerId) : []);

            if (lenders.length > 0) {
                finalBalances[borrowerId] -= loanAmount;
                const creditPerLender = loanAmount / lenders.length;
                lenders.forEach(lender => {
                    if (finalBalances[lender.id] !== undefined) {
                        finalBalances[lender.id] += creditPerLender;
                    }
                });
            }
        }
    });

    return finalBalances;
};

export type PeerToPeerTransaction<T = BalanceCalcEntry> = T & {
    contribution: number;
    runningP2PBalance: number;
};

export interface PeerBreakdown<T = BalanceCalcEntry> {
    netBalance: number;
    transactions: PeerToPeerTransaction<T>[];
}

export const calculatePeerToPeerBalances = <T extends BalanceCalcEntry = BalanceCalcEntry>(
    entries: T[],
    members: BalanceCalcMember[],
    perspectiveUserId: number,
    options?: { isChronological?: boolean }
): Map<number, PeerBreakdown<T>> => {
    const breakdown = new Map<number, PeerBreakdown<T>>();
    if (!perspectiveUserId || !members.length || !entries.length) {
        return breakdown;
    }

    const isParticipating = (m: BalanceCalcMember) => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined) return m.can_participate !== false;
        if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
        return true;
    };

    const calcMembers = members.filter(isParticipating);
    const otherMembers = members.filter(m => m.id !== perspectiveUserId && isParticipating(m));

    otherMembers.forEach(member => {
        breakdown.set(member.id, { netBalance: 0, transactions: [] });
    });

    const chronologicalEntries = [...entries];
    if (options?.isChronological === false) {
        chronologicalEntries.reverse();
    } else if (options?.isChronological !== true && chronologicalEntries.length > 1) {
        const firstCreatedAt = chronologicalEntries[0]?.created_at;
        const lastCreatedAt = chronologicalEntries[chronologicalEntries.length - 1]?.created_at;
        const firstTime = typeof firstCreatedAt === 'string' ? new Date(firstCreatedAt).getTime() : NaN;
        const lastTime = typeof lastCreatedAt === 'string' ? new Date(lastCreatedAt).getTime() : NaN;
        if (!isNaN(firstTime) && !isNaN(lastTime) && firstTime > lastTime) {
            chronologicalEntries.reverse();
        }
    }

    for (const entry of chronologicalEntries) {
        const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;

        if (entry.payer_shares && entry.beneficiary_shares && Array.isArray(entry.payer_shares) && Array.isArray(entry.beneficiary_shares)) {
            // Net Creditor / Net Debtor Prorating
            const netPositions = new Map<number, number>();
            let totalPosNet = 0;
            let totalNegNet = 0;

            members.forEach(m => {
                const pShare = entry.payer_shares!.find(p => p.userId === m.id);
                const bShare = entry.beneficiary_shares!.find(b => b.userId === m.id);
                const paid = pShare ? amount * (pShare.percentage / 100) : 0;
                const owed = bShare ? amount * (bShare.percentage / 100) : 0;
                const net = paid - owed;
                netPositions.set(m.id, net);
                if (net > 0.001) totalPosNet += net;
                else if (net < -0.001) totalNegNet += Math.abs(net);
            });

            const myNet = netPositions.get(perspectiveUserId) || 0;
            const totalNet = (totalPosNet + totalNegNet) / 2;

            if (totalNet > 0.001) {
                otherMembers.forEach(other => {
                    if (breakdown.has(other.id)) {
                        const otherNet = netPositions.get(other.id) || 0;
                        let contrib = 0;

                        if (myNet > 0.001 && otherNet < -0.001) {
                            // perspective user is creditor, other is debtor
                            contrib = (myNet * Math.abs(otherNet)) / totalNet;
                        } else if (myNet < -0.001 && otherNet > 0.001) {
                            // perspective user is debtor, other is creditor
                            contrib = - (Math.abs(myNet) * otherNet) / totalNet;
                        }

                        if (Math.abs(contrib) > 0.001) {
                            const data = breakdown.get(other.id)!;
                            data.netBalance += contrib;
                            data.transactions.push({
                                ...entry,
                                contribution: contrib,
                                runningP2PBalance: data.netBalance
                            });
                        }
                    }
                });
            }
            continue;
        }

        const payerId = entry.user_id;

        if (amount > 0) { // Legacy Expense
            const participants = entry.split_with_user_ids;
            const activeParticipants = participants && participants.length > 0
                ? members.filter(m => participants.includes(m.id) && isParticipating(m))
                : (participants === null || participants === undefined ? calcMembers : []);

            if (!activeParticipants || activeParticipants.length === 0) continue;
            const share = amount / activeParticipants.length;

            if (payerId === perspectiveUserId) {
                activeParticipants.forEach(p => {
                    if (p.id !== perspectiveUserId && breakdown.has(p.id)) {
                        const data = breakdown.get(p.id)!;
                        const contribution = share;
                        data.netBalance += contribution;
                        data.transactions.push({
                            ...entry,
                            contribution,
                            runningP2PBalance: data.netBalance
                        });
                    }
                });
            } else if (activeParticipants.some(p => p.id === perspectiveUserId) && breakdown.has(payerId)) {
                const data = breakdown.get(payerId)!;
                const contribution = -share;
                data.netBalance += contribution;
                data.transactions.push({
                    ...entry,
                    contribution,
                    runningP2PBalance: data.netBalance
                });
            }
        } else if (amount < 0) { // Legacy Loan
            const loanAmount = Math.abs(amount);
            const borrowerId = payerId;
            const participants = entry.split_with_user_ids;
            const lenders = participants && participants.length > 0
                ? calcMembers.filter(m => participants.includes(m.id))
                : (participants === null || participants === undefined ? calcMembers.filter(m => m.id !== borrowerId) : []);

            if (lenders.length === 0) continue;
            const creditPerLender = loanAmount / lenders.length;

            if (borrowerId === perspectiveUserId) {
                lenders.forEach(lender => {
                    if (breakdown.has(lender.id)) {
                        const data = breakdown.get(lender.id)!;
                        const contribution = -creditPerLender;
                        data.netBalance += contribution;
                        data.transactions.push({
                            ...entry,
                            contribution,
                            runningP2PBalance: data.netBalance
                        });
                    }
                });
            } else if (lenders.some(l => l.id === perspectiveUserId) && breakdown.has(borrowerId)) {
                const data = breakdown.get(borrowerId)!;
                const contribution = creditPerLender;
                data.netBalance += contribution;
                data.transactions.push({
                    ...entry,
                    contribution,
                    runningP2PBalance: data.netBalance
                });
            }
        }
    }

    breakdown.forEach(value => value.transactions.reverse());
    return breakdown;
};

