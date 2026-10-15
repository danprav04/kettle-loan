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
        'התחשב',
        'возврат',
        'перевод',
        'transfer'
    ];
    return settlementKeywords.some(kw => desc.includes(kw));
}

export interface TransitiveCoverageRoute {
    actualPayerId: number;
    actualPayerName: string;
    actualRecipientId: number;
    actualRecipientName: string;
    originalDebtorId: number;
    originalDebtorName: string;
    originalCreditorId: number;
    originalCreditorName: string;
    sourceDebtorId: number;
    sourceDebtorName: string;
    intermediaryMemberId: number;
    intermediaryMemberName: string;
    finalCreditorId: number;
    finalCreditorName: string;
    sourceDebtAmount: number;
    targetDebtAmount: number;
    amount: number;
    settlementEntry?: {
        id: string | number;
        description: string;
        amount: number;
        created_at?: string;
    };
}

export interface TransitiveCoverageBlock {
    id: string;
    description: string;
    shareAmount: number;
    fullAmount: number;
    targetSide: 'left' | 'right';
    relatedMemberId?: number;
    relatedMemberName?: string;
    isTransitive: true;
    isSettlement: boolean;
    isSettled: boolean;
    routeType: 'offset' | 'absorbed';
    sourceEntryId?: string | number;
    route?: TransitiveCoverageRoute;
}

export function calculateTransitiveCoverageBlocks<T extends BalanceCalcEntry = BalanceCalcEntry>(
    entries: T[],
    members: BalanceCalcMember[],
    personAId: number,
    personBId: number
): TransitiveCoverageBlock[] {
    if (!entries.length || !members.length || !personAId || !personBId || personAId === personBId) {
        return [];
    }

    const memberMap = new Map<number, string>();
    members.forEach(m => {
        if (m.username) memberMap.set(m.id, m.username);
    });
    const getName = (id: number) => memberMap.get(id) || `#${id}`;

    // Calculate P2P in simplified mode for Person A
    const p2pA = calculatePeerToPeerBalances(entries, members, personAId, { simplifyDebts: true });
    const pairData = p2pA.get(personBId);
    if (!pairData) return [];

    const totalReallocated = pairData.reallocatedAmount;
    if (Math.abs(totalReallocated) < 0.005) {
        return [];
    }

    const targetSide: 'left' | 'right' = totalReallocated > 0 ? 'left' : 'right';
    const totalMagnitude = Math.round(Math.abs(totalReallocated) * 100) / 100;

    // Detect if settlement entries exist
    const settlementEntries = entries.filter(e => isSettlementEntry(e as { description?: string | null }));
    const hasSettlements = settlementEntries.length > 0;

    const canonicalBalances = calculateAllMemberBalances(entries, members);
    const isRoomSettled =
        Math.abs(canonicalBalances[personAId] || 0) < 2.0 &&
        Math.abs(canonicalBalances[personBId] || 0) < 2.0;

    const calcMembers = members.filter(m => {
        if (m.role === 'observer') return false;
        if (m.can_participate !== undefined) return m.can_participate !== false;
        if (m.permissions?.canParticipate !== undefined) return m.permissions.canParticipate !== false;
        return true;
    });
    const simplifiedTransfers = calculateSimplifiedDebts(
        canonicalBalances,
        calcMembers.map(m => m.id)
    );

    // Find other members with opposite sign reallocations to attribute the route
    const candidates: { id: number; username: string; weight: number }[] = [];
    p2pA.forEach((otherData, otherId) => {
        if (otherId === personBId || otherId === personAId) return;
        const otherRealloc = otherData.reallocatedAmount;
        if (totalReallocated > 0 && otherRealloc < -0.005) {
            candidates.push({
                id: otherId,
                username: memberMap.get(otherId) || `#${otherId}`,
                weight: Math.abs(otherRealloc)
            });
        } else if (totalReallocated < 0 && otherRealloc > 0.005) {
            candidates.push({
                id: otherId,
                username: memberMap.get(otherId) || `#${otherId}`,
                weight: Math.abs(otherRealloc)
            });
        }
    });

    if (candidates.length === 0) {
        const p2pB = calculatePeerToPeerBalances(entries, members, personBId, { simplifyDebts: true });
        p2pB.forEach((otherData, otherId) => {
            if (otherId === personAId || otherId === personBId) return;
            const otherRealloc = otherData.reallocatedAmount;
            if (totalReallocated > 0 && otherRealloc > 0.005) {
                candidates.push({
                    id: otherId,
                    username: memberMap.get(otherId) || `#${otherId}`,
                    weight: Math.abs(otherRealloc)
                });
            } else if (totalReallocated < 0 && otherRealloc < -0.005) {
                candidates.push({
                    id: otherId,
                    username: memberMap.get(otherId) || `#${otherId}`,
                    weight: Math.abs(otherRealloc)
                });
            }
        });
    }

    const findSettlementEntry = (u1: number, u2: number) => {
        return settlementEntries.find(s => {
            const payer = s.user_id;
            const participants = s.split_with_user_ids || [];
            const bShares = s.beneficiary_shares || [];
            const isBeneficiary = (id: number) => participants.includes(id) || bShares.some(b => b.userId === id);
            return (payer === u1 && isBeneficiary(u2)) || (payer === u2 && isBeneficiary(u1));
        });
    };

    const buildRouteInfo = (
        candId: number | undefined,
        portion: number,
        settlement: any
    ): { routeType: 'offset' | 'absorbed'; route: TransitiveCoverageRoute } => {
        // Determine actual transfer payer and recipient
        let actualPayerId = personAId;
        let actualRecipientId = personBId;

        const findTransferBetween = (u1: number, u2: number) => {
            const st = simplifiedTransfers.find(
                t => (t.fromUserId === u1 && t.toUserId === u2) || (t.fromUserId === u2 && t.toUserId === u1)
            );
            return st;
        };

        if (settlement) {
            actualPayerId = settlement.user_id;
            const participants = settlement.split_with_user_ids || [];
            const bShares = settlement.beneficiary_shares || [];
            const firstBeneficiary = bShares[0]?.userId || participants.find((id: number) => id !== actualPayerId) || personBId;
            actualRecipientId = firstBeneficiary;
        } else if (candId) {
            const stAC = findTransferBetween(personAId, candId);
            const stBC = findTransferBetween(personBId, candId);
            const stAB = findTransferBetween(personAId, personBId);

            if (stAC) {
                actualPayerId = stAC.fromUserId;
                actualRecipientId = stAC.toUserId;
            } else if (stBC) {
                actualPayerId = stBC.fromUserId;
                actualRecipientId = stBC.toUserId;
            } else if (stAB) {
                actualPayerId = stAB.fromUserId;
                actualRecipientId = stAB.toUserId;
            }
        }

        const isSettlementPair =
            (actualPayerId === personAId && actualRecipientId === personBId) ||
            (actualPayerId === personBId && actualRecipientId === personAId);

        const routeType: 'offset' | 'absorbed' = isSettlementPair ? 'absorbed' : 'offset';

        // Determine original debtor and creditor of the underlying obligation
        let originalDebtorId = personAId;
        let originalCreditorId = personBId;

        if (routeType === 'absorbed') {
            // A settlement pair where creditor absorbed a 3rd party's claim
            // E.g. Marina absorbed Inna's debt, so Inna was original debtor to Marina
            if (candId) {
                originalDebtorId = candId;
                originalCreditorId = actualRecipientId;
            } else {
                originalDebtorId = actualPayerId;
                originalCreditorId = actualRecipientId;
            }
        } else {
            // Offset in a pairwise debt
            if (targetSide === 'left') {
                // Left side (Person A) receives credit
                originalDebtorId = personAId;
                originalCreditorId = personBId;
            } else {
                // Right side (Person B) receives credit, e.g. Inna in [Marina ↔ Inna]
                originalDebtorId = personBId;
                originalCreditorId = personAId;
            }
        }

        const membersInTriangle = [personAId, personBId];
        if (candId) membersInTriangle.push(candId);
        const intermediaryId =
            membersInTriangle.find(id => id !== actualPayerId && id !== actualRecipientId) ||
            candId ||
            originalDebtorId;

        const sourceDebtorId = actualPayerId;
        const finalCreditorId = actualRecipientId;

        const route: TransitiveCoverageRoute = {
            actualPayerId,
            actualPayerName: getName(actualPayerId),
            actualRecipientId,
            actualRecipientName: getName(actualRecipientId),
            originalDebtorId,
            originalDebtorName: getName(originalDebtorId),
            originalCreditorId,
            originalCreditorName: getName(originalCreditorId),
            sourceDebtorId,
            sourceDebtorName: getName(sourceDebtorId),
            intermediaryMemberId: intermediaryId,
            intermediaryMemberName: getName(intermediaryId),
            finalCreditorId,
            finalCreditorName: getName(finalCreditorId),
            sourceDebtAmount: portion,
            targetDebtAmount: portion,
            amount: portion,
            settlementEntry: settlement ? {
                id: settlement.id,
                description: settlement.description || 'Погашение долга',
                amount: typeof settlement.amount === 'string' ? parseFloat(settlement.amount) : settlement.amount,
                created_at: settlement.created_at
            } : undefined
        };

        return { routeType, route };
    };

    const blocks: TransitiveCoverageBlock[] = [];

    if (candidates.length === 0) {
        const relevantSettlement = findSettlementEntry(personAId, personBId);
        const { routeType, route } = buildRouteInfo(undefined, totalMagnitude, relevantSettlement);

        blocks.push({
            id: `transitive-${personAId}-${personBId}-0`,
            description: routeType === 'offset' ? 'reallocated_offset' : 'reallocated_absorbed',
            shareAmount: totalMagnitude,
            fullAmount: totalMagnitude,
            targetSide,
            isTransitive: true,
            isSettlement: hasSettlements,
            isSettled: hasSettlements && (Boolean(relevantSettlement) || isRoomSettled),
            routeType,
            sourceEntryId: relevantSettlement?.id,
            route
        });
        return blocks;
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let allocatedSum = 0;

    candidates.forEach((cand, idx) => {
        const isLast = idx === candidates.length - 1;
        const portion = isLast
            ? Math.round((totalMagnitude - allocatedSum) * 100) / 100
            : Math.round(((totalMagnitude * cand.weight) / totalWeight) * 100) / 100;

        if (portion > 0.005) {
            allocatedSum += portion;
            const relevantSettlement =
                findSettlementEntry(personAId, cand.id) ||
                findSettlementEntry(personBId, cand.id) ||
                findSettlementEntry(personAId, personBId);

            const { routeType, route } = buildRouteInfo(cand.id, portion, relevantSettlement);

            blocks.push({
                id: `transitive-${personAId}-${personBId}-${cand.id}`,
                description: routeType === 'offset' ? 'reallocated_offset' : 'reallocated_absorbed',
                shareAmount: portion,
                fullAmount: portion,
                targetSide,
                relatedMemberId: cand.id,
                relatedMemberName: cand.username,
                isTransitive: true,
                isSettlement: hasSettlements,
                isSettled: hasSettlements && (Boolean(relevantSettlement) || isRoomSettled),
                routeType,
                sourceEntryId: relevantSettlement?.id,
                route
            });
        }
    });

    return blocks;
}

