import { describe, it, expect } from 'vitest';
import {
    calculateAllMemberBalances,
    calculatePeerToPeerBalances,
    calculateTransitiveCoverageBlocks,
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

        // Specific assertions for Inna (userId: 1) with prorating (unsimplified)
        const innaP2P = calculatePeerToPeerBalances([entry], members, 1, { simplifyDebts: false });
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
        const marinaP2P = calculatePeerToPeerBalances([entry], members, 3, { simplifyDebts: false });
        const marinaToInna = marinaP2P.get(1)?.netBalance ?? 0;
        expect(marinaToInna).toBeCloseTo(-innaToMarina, 2);

        // Verify skew symmetry: Elvira looking at Inna
        const elviraP2P = calculatePeerToPeerBalances([entry], members, 4, { simplifyDebts: false });
        const elviraToInna = elviraP2P.get(1)?.netBalance ?? 0;
        expect(elviraToInna).toBeCloseTo(-innaToElvira, 2);
    });

    it('should simplify multi-party room debts so net debtors directly owe net creditors', () => {
        // Scenario matching user trip:
        // Marina paid for hotels/activities (Creditor: +4000)
        // Elvira is small debtor (-400)
        // Ira is debtor (-1600)
        // Inna is debtor (-2000)
        const entries: BalanceCalcEntry[] = [
            {
                amount: 4000,
                user_id: 3, // Marina
                description: 'Big trip expense',
                payer_shares: [{ userId: 3, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 50 },  // Inna: 2000
                    { userId: 2, percentage: 40 },  // Ira: 1600
                    { userId: 4, percentage: 10 },  // Elvira: 400
                ],
            },
        ];

        // Inna's perspective: owes Marina 2000, settled with Elvira and Ira
        const innaP2P = calculatePeerToPeerBalances(entries, members, 1);
        expect(innaP2P.get(3)?.netBalance).toBe(-2000); // owes Marina
        expect(innaP2P.get(2)?.netBalance).toBe(0); // settled with Ira
        expect(innaP2P.get(4)?.netBalance).toBe(0); // settled with Elvira

        // Elvira's perspective: owes Marina 400, settled with Inna and Ira
        const elviraP2P = calculatePeerToPeerBalances(entries, members, 4);
        expect(elviraP2P.get(3)?.netBalance).toBe(-400); // owes Marina
        expect(elviraP2P.get(1)?.netBalance).toBe(0); // settled with Inna
        expect(elviraP2P.get(2)?.netBalance).toBe(0); // settled with Ira

        // Marina's perspective: owed by Inna, Ira, and Elvira
        const marinaP2P = calculatePeerToPeerBalances(entries, members, 3);
        expect(marinaP2P.get(1)?.netBalance).toBe(2000); // Inna owes Marina
        expect(marinaP2P.get(2)?.netBalance).toBe(1600); // Ira owes Marina
        expect(marinaP2P.get(4)?.netBalance).toBe(400);  // Elvira owes Marina
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

    it('should provide transparent directNetBalance and reallocatedAmount in simplified and direct modes', () => {
        // Marina pays 300 for Marina (100), Ira (100), and Elvira (100).
        // Elvira pays 100 for Elvira (50) and Ira (50).
        // Total positions:
        // Marina: +200 creditor
        // Ira: -150 debtor
        // Elvira: -50 debtor
        const entries: BalanceCalcEntry[] = [
            {
                amount: 300,
                user_id: 3, // Marina
                description: 'Hotel with Marina',
                payer_shares: [{ userId: 3, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 3, percentage: 33.333333 },
                    { userId: 2, percentage: 33.333333 }, // Ira: 100
                    { userId: 4, percentage: 33.333334 }, // Elvira: 100
                ],
            },
            {
                amount: 100,
                user_id: 4, // Elvira
                description: 'Dinner with Elvira',
                payer_shares: [{ userId: 4, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 4, percentage: 50 },
                    { userId: 2, percentage: 50 }, // Ira: 50
                ],
            },
        ];

        // Ira (2) looking in Simplified mode (default):
        const simplified = calculatePeerToPeerBalances(entries, members, 2, { simplifyDebts: true });
        const marinaData = simplified.get(3)!;
        const elviraData = simplified.get(4)!;

        // In simplified mode: Ira pays Marina 150 (direct 100 + 50 reallocated from Elvira)
        expect(marinaData.netBalance).toBe(-150);
        expect(marinaData.directNetBalance).toBe(-100);
        expect(marinaData.simplifiedNetBalance).toBe(-150);
        expect(marinaData.reallocatedAmount).toBe(-50);
        expect(marinaData.transactions[0].runningP2PBalance).toBe(-100);

        // Elvira is settled under simplification, but directNetBalance (-50) and reallocatedAmount (+50) are preserved:
        expect(elviraData.netBalance).toBe(0);
        expect(elviraData.directNetBalance).toBe(-50);
        expect(elviraData.simplifiedNetBalance).toBe(0);
        expect(elviraData.reallocatedAmount).toBe(50);
        expect(elviraData.transactions[0].runningP2PBalance).toBe(-50);

        // Ira (2) looking in Direct mode (simplifyDebts: false):
        const direct = calculatePeerToPeerBalances(entries, members, 2, { simplifyDebts: false });
        const marinaDirect = direct.get(3)!;
        const elviraDirect = direct.get(4)!;

        // In direct mode: netBalance equals directNetBalance and matches running transaction balance
        expect(marinaDirect.netBalance).toBe(-100);
        expect(marinaDirect.transactions[0].runningP2PBalance).toBe(-100);
        expect(elviraDirect.netBalance).toBe(-50);
        expect(elviraDirect.transactions[0].runningP2PBalance).toBe(-50);
    });

    it('should reconcile transitive pairs and overpayments in simplified check coverage (reproducing Elvira, Marina, Inna, Ira scenario)', () => {
        // Members: 1: ИННА, 2: ИРА, 3: MARINA, 4: ЭЛЬВИРА
        const entries: BalanceCalcEntry[] = [
            {
                id: 'e1',
                amount: 1107.60,
                user_id: 1, // Inna
                split_with_user_ids: [4], // for Elvira
                description: 'Inna paid for Elvira',
                created_at: '2026-09-01T10:00:00Z',
            },
            {
                id: 'e2',
                amount: 1107.29,
                user_id: 2, // Ira
                split_with_user_ids: [4], // for Elvira
                description: 'Ira paid for Elvira',
                created_at: '2026-09-01T11:00:00Z',
            },
            {
                id: 'e3',
                amount: 224.69,
                user_id: 3, // Marina
                split_with_user_ids: [4], // for Elvira
                description: 'Marina paid for Elvira',
                created_at: '2026-09-01T12:00:00Z',
            },
            {
                id: 'e4',
                amount: 1107.55,
                user_id: 3, // Marina
                split_with_user_ids: [1], // for Inna
                description: 'Marina paid for Inna',
                created_at: '2026-09-01T13:00:00Z',
            },
            {
                id: 'e5',
                amount: 1106.94,
                user_id: 3, // Marina
                split_with_user_ids: [2], // for Ira
                description: 'Marina paid for Ira',
                created_at: '2026-09-01T14:00:00Z',
            },
            // Elvira settles with Marina for 2438.68 (simplified settlement)
            {
                id: 's1',
                amount: 2438.68,
                user_id: 4, // Elvira
                split_with_user_ids: [3],
                payer_shares: [{ userId: 4, percentage: 100 }],
                beneficiary_shares: [{ userId: 3, percentage: 100 }],
                description: 'Погашение долга (Упрощенный перевод)',
                created_at: '2026-09-02T10:00:00Z',
            },
        ];

        // 1. Pair: Elvira (4) ↔ Inna (1)
        const elviraInnaBlocks = calculateTransitiveCoverageBlocks(entries, members, 4, 1);
        expect(elviraInnaBlocks.length).toBeGreaterThan(0);
        const elviraInnaTotal = elviraInnaBlocks.reduce((sum, b) => sum + b.shareAmount, 0);
        expect(elviraInnaTotal).toBeCloseTo(1107.55, 2);
        expect(elviraInnaBlocks[0].targetSide).toBe('left'); // Placed on Elvira's side
        expect(elviraInnaBlocks[0].relatedMemberName).toBe('MARINA');
        expect(elviraInnaBlocks[0].isSettled).toBe(true);
        expect(elviraInnaBlocks[0].route?.actualPayerName).toBe('ЭЛЬВИРА');
        expect(elviraInnaBlocks[0].route?.actualRecipientName).toBe('MARINA');
        expect(elviraInnaBlocks[0].route?.originalDebtorName).toBe('ЭЛЬВИРА');
        expect(elviraInnaBlocks[0].route?.originalCreditorName).toBe('ИННА');

        // 2. Pair: Elvira (4) ↔ Ira (2)
        const elviraIraBlocks = calculateTransitiveCoverageBlocks(entries, members, 4, 2);
        expect(elviraIraBlocks.length).toBeGreaterThan(0);
        const elviraIraTotal = elviraIraBlocks.reduce((sum, b) => sum + b.shareAmount, 0);
        expect(elviraIraTotal).toBeCloseTo(1106.94, 2);
        expect(elviraIraBlocks[0].targetSide).toBe('left'); // Placed on Elvira's side
        expect(elviraIraBlocks[0].relatedMemberName).toBe('MARINA');
        expect(elviraIraBlocks[0].isSettled).toBe(true);
        expect(elviraIraBlocks[0].route?.actualPayerName).toBe('ЭЛЬВИРА');
        expect(elviraIraBlocks[0].route?.actualRecipientName).toBe('MARINA');
        expect(elviraIraBlocks[0].route?.originalDebtorName).toBe('ЭЛЬВИРА');
        expect(elviraIraBlocks[0].route?.originalCreditorName).toBe('ИРА');

        // 3. Pair: Elvira (4) ↔ Marina (3)
        // Elvira paid 2438.68 settlement; Marina paid 224.69 check.
        // Direct net balance is +2213.99 overpayment.
        // Transitive blocks should add ~2213.99 to Marina's side ('right') from Inna and Ira!
        const elviraMarinaBlocks = calculateTransitiveCoverageBlocks(entries, members, 4, 3);
        expect(elviraMarinaBlocks.length).toBe(2);
        const elviraMarinaTotal = elviraMarinaBlocks.reduce((sum, b) => sum + b.shareAmount, 0);
        expect(elviraMarinaTotal).toBeCloseTo(2214.49, 2);
        expect(elviraMarinaBlocks.every(b => b.targetSide === 'right')).toBe(true); // Placed on Marina's side
        const names = elviraMarinaBlocks.map(b => b.relatedMemberName);
        expect(names).toContain('ИННА');
        expect(names).toContain('ИРА');
        expect(elviraMarinaBlocks[0].route?.actualPayerName).toBe('ЭЛЬВИРА');
        expect(elviraMarinaBlocks[0].route?.actualRecipientName).toBe('MARINA');

        // 4. Pair: Marina (3) ↔ Inna (1)
        // Marina paid 1107.55 for Inna.
        // Inna's side ('right' from Marina's perspective) should receive 1107.55 block via Elvira!
        const marinaInnaBlocks = calculateTransitiveCoverageBlocks(entries, members, 3, 1);
        expect(marinaInnaBlocks.length).toBeGreaterThan(0);
        const marinaInnaTotal = marinaInnaBlocks.reduce((sum, b) => sum + b.shareAmount, 0);
        expect(marinaInnaTotal).toBeCloseTo(1107.55, 2);
        expect(marinaInnaBlocks[0].targetSide).toBe('right');
        expect(marinaInnaBlocks[0].relatedMemberName).toBe('ЭЛЬВИРА');
        expect(marinaInnaBlocks[0].route).toBeDefined();
        expect(marinaInnaBlocks[0].route?.actualPayerName).toBe('ЭЛЬВИРА');
        expect(marinaInnaBlocks[0].route?.actualRecipientName).toBe('MARINA');
        expect(marinaInnaBlocks[0].route?.originalDebtorName).toBe('ИННА');
        expect(marinaInnaBlocks[0].route?.originalCreditorName).toBe('MARINA');
        expect(marinaInnaBlocks[0].route?.sourceDebtorName).toBe('ЭЛЬВИРА');
        expect(marinaInnaBlocks[0].route?.intermediaryMemberName).toBe('ИННА');
        expect(marinaInnaBlocks[0].route?.finalCreditorName).toBe('MARINA');
        expect(marinaInnaBlocks[0].route?.settlementEntry?.description).toBe('Погашение долга (Упрощенный перевод)');

        // 5. Pair: Marina (3) ↔ Ira (2)
        // Marina paid 1106.94 for Ira.
        // Ira's side ('right' from Marina's perspective) should receive 1106.94 block via Elvira!
        const marinaIraBlocks = calculateTransitiveCoverageBlocks(entries, members, 3, 2);
        expect(marinaIraBlocks.length).toBeGreaterThan(0);
        const marinaIraTotal = marinaIraBlocks.reduce((sum, b) => sum + b.shareAmount, 0);
        expect(marinaIraTotal).toBeCloseTo(1106.94, 2);
        expect(marinaIraBlocks[0].targetSide).toBe('right');
        expect(marinaIraBlocks[0].relatedMemberName).toBe('ЭЛЬВИРА');
        expect(marinaIraBlocks[0].route?.actualPayerName).toBe('ЭЛЬВИРА');
        expect(marinaIraBlocks[0].route?.actualRecipientName).toBe('MARINA');
        expect(marinaIraBlocks[0].route?.originalDebtorName).toBe('ИРА');
        expect(marinaIraBlocks[0].route?.originalCreditorName).toBe('MARINA');
    });
});

