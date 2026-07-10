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
                ? calcMembers.filter(m => participants.includes(m.id))
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
                ? calcMembers.filter(m => participants.includes(m.id))
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
