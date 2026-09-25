import { describe, it, expect } from 'vitest';
import {
    calculateAllMemberBalances,
    calculatePeerToPeerBalances,
    BalanceCalcMember,
    BalanceCalcEntry
} from '../lib/balance-calc';

describe('calculatePeerToPeerBalances', () => {
    const members: BalanceCalcMember[] = [
        { id: 1, username: 'ИННА' },
        { id: 2, username: 'ИРА' },
        { id: 3, username: 'MARINA' },
        { id: 4, username: 'ЭЛЬВИРА' },
    ];

    it('should correctly prorate multi-payer multi-beneficiary entry without double-counting (Entry #52 reproduction)', () => {
        // Entry #52: Amount 13205
        // Payers: Elvira (4) 66.6%, Marina (3) 33.4%
        // Beneficiaries: Marina (3) 16.7%, Inna (1) 33.3%, Elvira (4) 16.7%, Ira (2) 33.3%
        const entry: BalanceCalcEntry = {
            amount: 13205,
            user_id: 4,
            description: 'Покупка Франки CHF 3430£',
            created_at: '2026-09-03T11:01:24Z',
            payer_shares: [
                { userId: 4, percentage: 66.6 },
                { userId: 3, percentage: 33.4 },
            ],
            beneficiary_shares: [
                { userId: 3, percentage: 16.7 },
                { userId: 1, percentage: 33.3 },
                { userId: 4, percentage: 16.7 },
                { userId: 2, percentage: 33.3 },
            ],
        };

        const canonical = calculateAllMemberBalances([entry], members);

        // Check for each member
        for (const m of members) {
            const p2p = calculatePeerToPeerBalances([entry], members, m.id);
            let p2pSum = 0;
            p2p.forEach(val => {
                p2pSum += val.netBalance;
            });
            // Total P2P sum must equal the canonical balance
            expect(p2pSum).toBeCloseTo(canonical[m.id], 1);
        }

        // Specific assertions for Inna (userId: 1)
        const innaP2P = calculatePeerToPeerBalances([entry], members, 1);
        const innaToElvira = innaP2P.get(4)?.netBalance ?? 0;
        const innaToMarina = innaP2P.get(3)?.netBalance ?? 0;
        const innaToIra = innaP2P.get(2)?.netBalance ?? 0;

        // Inna should not owe Ira anything for this entry
        expect(innaToIra).toBe(0);

        // Inna's total debt should be approx -4397.26, NOT -6602.49 (which was the bug!)
        expect(innaToElvira + innaToMarina).toBeCloseTo(-4397.265, 1);
        expect(innaToElvira).toBeLessThan(0); // owes Elvira
        expect(innaToMarina).toBeLessThan(0); // owes Marina

        // Verify skew symmetry: Marina looking at Inna
        const marinaP2P = calculatePeerToPeerBalances([entry], members, 3);
        const marinaToInna = marinaP2P.get(1)?.netBalance ?? 0;
        expect(marinaToInna).toBeCloseTo(-innaToMarina, 2);

        // Verify skew symmetry: Elvira looking at Inna
        const elviraP2P = calculatePeerToPeerBalances([entry], members, 4);
        const elviraToInna = elviraP2P.get(1)?.netBalance ?? 0;
        expect(elviraToInna).toBeCloseTo(-innaToElvira, 2);
    });

    it('should correctly handle multi-payer cruise where one person pays their exact share (Entry #3 reproduction)', () => {
        // Ira paid 33.3% and consumed 33.3%, so Ira paid exactly for herself
        const entry: BalanceCalcEntry = {
            amount: 39036,
            user_id: 3,
            description: 'Круиз Монарх',
            created_at: '2026-07-10T21:43:57Z',
            payer_shares: [
                { userId: 2, percentage: 33.3 },
                { userId: 3, percentage: 53.9 },
                { userId: 1, percentage: 12.8 },
            ],
            beneficiary_shares: [
                { userId: 3, percentage: 16.7 },
                { userId: 1, percentage: 33.3 },
                { userId: 4, percentage: 16.7 },
                { userId: 2, percentage: 33.3 },
            ],
        };

        const canonical = calculateAllMemberBalances([entry], members);

        for (const m of members) {
            const p2p = calculatePeerToPeerBalances([entry], members, m.id);
            let p2pSum = 0;
            p2p.forEach(val => {
                p2pSum += val.netBalance;
            });
            expect(p2pSum).toBeCloseTo(canonical[m.id], 1);
        }

        // Ira should have netBalance of 0 with all members
        const iraP2P = calculatePeerToPeerBalances([entry], members, 2);
        expect(iraP2P.get(1)?.netBalance ?? 0).toBe(0);
        expect(iraP2P.get(3)?.netBalance ?? 0).toBe(0);
        expect(iraP2P.get(4)?.netBalance ?? 0).toBe(0);
    });

    it('should correctly calculate a single payer equal split', () => {
        const entry: BalanceCalcEntry = {
            amount: 300,
            user_id: 1,
            description: 'Dinner',
            payer_shares: [{ userId: 1, percentage: 100 }],
            beneficiary_shares: [
                { userId: 1, percentage: 33.333333 },
                { userId: 2, percentage: 33.333333 },
                { userId: 3, percentage: 33.333334 },
            ],
        };

        const p2p1 = calculatePeerToPeerBalances([entry], members, 1);
        expect(p2p1.get(2)?.netBalance).toBeCloseTo(100, 2);
        expect(p2p1.get(3)?.netBalance).toBeCloseTo(100, 2);

        const p2p2 = calculatePeerToPeerBalances([entry], members, 2);
        expect(p2p2.get(1)?.netBalance).toBeCloseTo(-100, 2);
        expect(p2p2.get(3)?.netBalance).toBe(0);
    });

    it('should correctly handle settle-up entries', () => {
        const expense: BalanceCalcEntry = {
            amount: 100,
            user_id: 1,
            description: 'Lunch',
            payer_shares: [{ userId: 1, percentage: 100 }],
            beneficiary_shares: [
                { userId: 1, percentage: 50 },
                { userId: 2, percentage: 50 },
            ],
        };

        const settlement: BalanceCalcEntry = {
            amount: 50,
            user_id: 2,
            description: 'Settle up',
            payer_shares: [{ userId: 2, percentage: 100 }],
            beneficiary_shares: [{ userId: 1, percentage: 100 }],
        };

        const p2p1 = calculatePeerToPeerBalances([expense, settlement], members, 1);
        expect(p2p1.get(2)?.netBalance).toBeCloseTo(0, 2);

        const p2p2 = calculatePeerToPeerBalances([expense, settlement], members, 2);
        expect(p2p2.get(1)?.netBalance).toBeCloseTo(0, 2);
    });

    it('should support legacy entries without shares', () => {
        const legacyExpense: BalanceCalcEntry = {
            amount: 200,
            user_id: 1,
            description: 'Legacy Taxi',
            split_with_user_ids: [1, 2],
        };

        const p2p1 = calculatePeerToPeerBalances([legacyExpense], members, 1);
        expect(p2p1.get(2)?.netBalance).toBe(100);

        const legacyLoan: BalanceCalcEntry = {
            amount: -150,
            user_id: 2, // borrower
            description: 'Legacy Loan',
            split_with_user_ids: [1, 3], // lenders
        };

        const p2pBorrower = calculatePeerToPeerBalances([legacyLoan], members, 2);
        expect(p2pBorrower.get(1)?.netBalance).toBe(-75);
        expect(p2pBorrower.get(3)?.netBalance).toBe(-75);

        const p2pLender = calculatePeerToPeerBalances([legacyLoan], members, 1);
        expect(p2pLender.get(2)?.netBalance).toBe(75);
    });

    it('should maintain the invariant that sum of P2P balances equals Total Perspective Balance', () => {
        const testEntries: BalanceCalcEntry[] = [
            {
                amount: 1000,
                user_id: 1,
                description: 'Hotel',
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 25 },
                    { userId: 2, percentage: 25 },
                    { userId: 3, percentage: 25 },
                    { userId: 4, percentage: 25 },
                ],
            },
            {
                amount: 600,
                user_id: 3,
                description: 'Excursion',
                payer_shares: [
                    { userId: 2, percentage: 50 },
                    { userId: 3, percentage: 50 },
                ],
                beneficiary_shares: [
                    { userId: 1, percentage: 30 },
                    { userId: 2, percentage: 30 },
                    { userId: 4, percentage: 40 },
                ],
            },
            {
                amount: 200,
                user_id: 4,
                description: 'Dinner',
                payer_shares: [{ userId: 4, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 50 },
                    { userId: 3, percentage: 50 },
                ],
            },
            {
                amount: 150,
                user_id: 1,
                description: 'Partial Repayment',
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [{ userId: 2, percentage: 100 }],
            },
        ];

        const canonical = calculateAllMemberBalances(testEntries, members);

        members.forEach(m => {
            const p2p = calculatePeerToPeerBalances(testEntries, members, m.id);
            let p2pSum = 0;
            p2p.forEach(val => {
                p2pSum += val.netBalance;
            });
            expect(p2pSum).toBeCloseTo(canonical[m.id], 2);
        });
    });
});
