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

    Object.keys(finalBalances).forEach(key => {
        const id = parseInt(key, 10);
        finalBalances[id] = Math.round(finalBalances[id] * 100) / 100;
    });

    return finalBalances;
};

export type PeerToPeerTransaction<T = BalanceCalcEntry> = T & {
    contribution: number;
    runningP2PBalance: number;
};

export interface PeerBreakdown<T = BalanceCalcEntry> {
    netBalance: number;
    directNetBalance: number;
    simplifiedNetBalance: number;
    reallocatedAmount: number;
    transactions: PeerToPeerTransaction<T>[];
}

export interface SimplifiedTransfer {
    fromUserId: number;
    toUserId: number;
    amount: number;
}

export function calculateSimplifiedDebts(
    canonicalBalances: { [userId: number]: number },
    memberIds: number[]
): SimplifiedTransfer[] {
    const creditors: { userId: number; amount: number }[] = [];
    const debtors: { userId: number; amount: number }[] = [];

    memberIds.forEach(id => {
        const bal = canonicalBalances[id] || 0;
        if (bal > 0.005) {
            creditors.push({ userId: id, amount: bal });
        } else if (bal < -0.005) {
            debtors.push({ userId: id, amount: -bal });
        }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Minor cent-rounding normalization: ensure total debtors equals total creditors
    const totalCred = creditors.reduce((sum, c) => sum + c.amount, 0);
    const totalDeb = debtors.reduce((sum, d) => sum + d.amount, 0);
    const roundingDiff = Math.round((totalCred - totalDeb) * 100) / 100;
    if (Math.abs(roundingDiff) > 0.005 && Math.abs(roundingDiff) < 2 && debtors.length > 0) {
        debtors[debtors.length - 1].amount = Math.round((debtors[debtors.length - 1].amount + roundingDiff) * 100) / 100;
    }

    const transfers: SimplifiedTransfer[] = [];
    let cIdx = 0;
    let dIdx = 0;

    while (cIdx < creditors.length && dIdx < debtors.length) {
        const creditor = creditors[cIdx];
        const debtor = debtors[dIdx];

        const settleAmount = Math.min(creditor.amount, debtor.amount);
        if (settleAmount > 0.005) {
            transfers.push({
                fromUserId: debtor.userId,
                toUserId: creditor.userId,
                amount: Math.round(settleAmount * 100) / 100
            });
        }

        creditor.amount -= settleAmount;
        debtor.amount -= settleAmount;

        if (creditor.amount < 0.005) cIdx++;
        if (debtor.amount < 0.005) dIdx++;
    }

    return transfers;
}

export const calculatePeerToPeerBalances = <T extends BalanceCalcEntry = BalanceCalcEntry>(
    entries: T[],
    members: BalanceCalcMember[],
    perspectiveUserId: number,
    options?: { isChronological?: boolean; simplifyDebts?: boolean }
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
        breakdown.set(member.id, {
            netBalance: 0,
            directNetBalance: 0,
            simplifiedNetBalance: 0,
            reallocatedAmount: 0,
            transactions: []
        });
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
                                contribution: Math.round(contrib * 100) / 100,
                                runningP2PBalance: Math.round(data.netBalance * 100) / 100
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
                            contribution: Math.round(contribution * 100) / 100,
                            runningP2PBalance: Math.round(data.netBalance * 100) / 100
                        });
                    }
                });
            } else if (activeParticipants.some(p => p.id === perspectiveUserId) && breakdown.has(payerId)) {
                const data = breakdown.get(payerId)!;
                const contribution = -share;
                data.netBalance += contribution;
                data.transactions.push({
                    ...entry,
                    contribution: Math.round(contribution * 100) / 100,
                    runningP2PBalance: Math.round(data.netBalance * 100) / 100
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
                            contribution: Math.round(contribution * 100) / 100,
                            runningP2PBalance: Math.round(data.netBalance * 100) / 100
                        });
                    }
                });
            } else if (lenders.some(l => l.id === perspectiveUserId) && breakdown.has(borrowerId)) {
                const data = breakdown.get(borrowerId)!;
                const contribution = creditPerLender;
                data.netBalance += contribution;
                data.transactions.push({
                    ...entry,
                    contribution: Math.round(contribution * 100) / 100,
                    runningP2PBalance: Math.round(data.netBalance * 100) / 100
                });
            }
        }
    }

    const canonicalBalances = calculateAllMemberBalances(entries, members);
    const simplifiedTransfers = calculateSimplifiedDebts(
        canonicalBalances,
        calcMembers.map(m => m.id)
    );

    otherMembers.forEach(other => {
        const data = breakdown.get(other.id);
        if (data) {
            const direct = Math.round(data.netBalance * 100) / 100;
            data.directNetBalance = direct;

            const iOweOther = simplifiedTransfers.find(
                t => t.fromUserId === perspectiveUserId && t.toUserId === other.id
            );
            const otherOwesMe = simplifiedTransfers.find(
                t => t.fromUserId === other.id && t.toUserId === perspectiveUserId
            );

            let simplified = 0;
            if (iOweOther) {
                simplified = -iOweOther.amount;
            } else if (otherOwesMe) {
                simplified = otherOwesMe.amount;
            }

            data.simplifiedNetBalance = simplified;
            data.reallocatedAmount = Math.round((simplified - direct) * 100) / 100;

            if (options?.simplifyDebts !== false) {
                data.netBalance = simplified;
            } else {
                data.netBalance = direct;
            }
        }
    });

    breakdown.forEach(value => value.transactions.reverse());
    return breakdown;
};

export function calculateDirectTransfers<T extends BalanceCalcEntry = BalanceCalcEntry>(
    entries: T[],
    members: BalanceCalcMember[]
): SimplifiedTransfer[] {
    if (!entries.length || !members.length) return [];

    const isParticipating = (m: BalanceCalcMember) => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined) return m.can_participate !== false;
        if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
        return true;
    };

    const calcMembers = members.filter(isParticipating);
    const directTransfers: SimplifiedTransfer[] = [];

    for (let i = 0; i < calcMembers.length; i++) {
        const memberA = calcMembers[i];
        const p2p = calculatePeerToPeerBalances(entries, members, memberA.id, { simplifyDebts: false });

        for (let j = i + 1; j < calcMembers.length; j++) {
            const memberB = calcMembers[j];
            const data = p2p.get(memberB.id);
            if (!data) continue;

            const bal = data.directNetBalance;
            if (bal > 0.005) {
                // From perspective of A: B has positive balance, so B owes A
                directTransfers.push({
                    fromUserId: memberB.id,
                    toUserId: memberA.id,
                    amount: Math.round(bal * 100) / 100
                });
            } else if (bal < -0.005) {
                // A owes B
                directTransfers.push({
                    fromUserId: memberA.id,
                    toUserId: memberB.id,
                    amount: Math.round(-bal * 100) / 100
                });
            }
        }
    }

    directTransfers.sort((a, b) => b.amount - a.amount);
    return directTransfers;
}

