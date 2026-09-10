// src/__tests__/stats-calc.test.ts
import { describe, it, expect } from 'vitest';
import {
    calculateRoomStats,
    isSettlementEntry,
    sanitizeZero,
    formatCurrencyAmount,
    StatsMember
} from '../lib/stats-calc';
import { Entry } from '../lib/offline-sync';

describe('Room Statistics Calculations', () => {
    const members: StatsMember[] = [
        { id: 1, username: 'Alice', role: 'admin', can_participate: true, permissions: { canParticipate: true } },
        { id: 2, username: 'Bob', role: 'member', can_participate: true, permissions: { canParticipate: true } },
        { id: 3, username: 'Charlie', role: 'member', can_participate: true, permissions: { canParticipate: true } },
        { id: 4, username: 'Dave', role: 'observer' }
    ];

    it('should correctly identify settlement descriptions across languages', () => {
        expect(isSettlementEntry({ description: 'Settle up' })).toBe(true);
        expect(isSettlementEntry({ description: 'settlement' })).toBe(true);
        expect(isSettlementEntry({ description: 'Debt repayment' })).toBe(true);
        expect(isSettlementEntry({ description: 'Погашение долга' })).toBe(true);
        expect(isSettlementEntry({ description: 'Взаимный расчет' })).toBe(true);
        expect(isSettlementEntry({ description: 'סגירת חוב' })).toBe(true);
        expect(isSettlementEntry({ description: 'סגור חוב' })).toBe(true);
        expect(isSettlementEntry({ description: 'התחשבנות' })).toBe(true);
        expect(isSettlementEntry({ description: 'Dinner with team' })).toBe(false);
        expect(isSettlementEntry({ description: 'Groceries' })).toBe(false);
    });

    it('should sanitize negative zeros and format currencies cleanly', () => {
        expect(sanitizeZero(-0.0001)).toBe(0);
        expect(sanitizeZero(0)).toBe(0);
        expect(sanitizeZero(-0.004)).toBe(0);
        expect(sanitizeZero(-0.01)).toBe(-0.01);
        expect(sanitizeZero(10.5)).toBe(10.5);

        expect(formatCurrencyAmount(0)).toBe('0');
        expect(formatCurrencyAmount(-0.0001)).toBe('0');
        expect(formatCurrencyAmount(50)).toBe('50');
        expect(formatCurrencyAmount(12.5)).toBe('12.50');
        expect(formatCurrencyAmount(99.99)).toBe('99.99');
    });

    it('should calculate standard expenses and biggest expense accurately', () => {
        const entries: Entry[] = [
            {
                id: 1,
                amount: '120.00',
                description: 'Supermarket',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: [1, 2, 3],
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 33.333333 },
                    { userId: 2, percentage: 33.333333 },
                    { userId: 3, percentage: 33.333334 }
                ]
            },
            {
                id: 2,
                amount: '60.00',
                description: 'Taxi',
                created_at: new Date().toISOString(),
                username: 'Bob',
                user_id: 2,
                split_with_user_ids: [1, 2],
                payer_shares: [{ userId: 2, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 50 },
                    { userId: 2, percentage: 50 }
                ]
            }
        ];

        const stats = calculateRoomStats(entries, members);
        expect(stats).not.toBeNull();
        expect(stats!.totalExpenses).toBe(180);
        expect(stats!.totalLoans).toBe(0);
        expect(stats!.totalSettlements).toBe(0);
        expect(stats!.totalEntries).toBe(2);
        expect(stats!.biggestExpense).toEqual({ description: 'Supermarket', amount: 120 });
        expect(stats!.averageExpensePerMember).toBe(60); // 180 / 3 eligible members

        const alice = stats!.memberContributions.get(1)!;
        const bob = stats!.memberContributions.get(2)!;
        const charlie = stats!.memberContributions.get(3)!;
        const dave = stats!.memberContributions.get(4)!;

        // Alice paid 120, share is 40 + 30 = 70. Net = +50
        expect(alice.paid).toBe(120);
        expect(alice.share).toBe(70);
        expect(alice.net).toBe(50);

        // Bob paid 60, share is 40 + 30 = 70. Net = -10
        expect(bob.paid).toBe(60);
        expect(bob.share).toBe(70);
        expect(bob.net).toBe(-10);

        // Charlie paid 0, share is 40. Net = -40
        expect(charlie.paid).toBe(0);
        expect(charlie.share).toBe(40);
        expect(charlie.net).toBe(-40);

        // Dave is an observer
        expect(dave.net).toBe(0);
        expect(dave.isEligible).toBe(false);
    });

    it('should NOT treat debt settlements as expenses and not select them as biggest expense', () => {
        const entries: Entry[] = [
            {
                id: 1,
                amount: '100.00',
                description: 'Dinner',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: [1, 2],
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 50 },
                    { userId: 2, percentage: 50 }
                ]
            },
            // Bob settles 50 with Alice
            {
                id: 2,
                amount: '50.00',
                description: 'Settle up',
                created_at: new Date().toISOString(),
                username: 'Bob',
                user_id: 2,
                split_with_user_ids: [1],
                payer_shares: [{ userId: 2, percentage: 100 }],
                beneficiary_shares: [{ userId: 1, percentage: 100 }]
            }
        ];

        const stats = calculateRoomStats(entries, members);
        expect(stats).not.toBeNull();

        // Total expenses MUST remain 100, NOT 150!
        expect(stats!.totalExpenses).toBe(100);
        // Settlement is recorded separately
        expect(stats!.totalSettlements).toBe(50);
        // Biggest expense MUST be Dinner, NOT Settle up!
        expect(stats!.biggestExpense).toEqual({ description: 'Dinner', amount: 100 });

        const alice = stats!.memberContributions.get(1)!;
        const bob = stats!.memberContributions.get(2)!;

        // Alice paid 100 for dinner, her share is 50. She received 50 settlement.
        expect(alice.paid).toBe(100);
        expect(alice.share).toBe(50);
        expect(alice.settled).toBe(-50); // received repayment
        expect(alice.net).toBe(0); // Fully settled!

        // Bob paid 0 for dinner, his share is 50. He paid 50 settlement.
        expect(bob.paid).toBe(0);
        expect(bob.share).toBe(50);
        expect(bob.settled).toBe(50); // paid repayment
        expect(bob.net).toBe(0); // Fully settled!
    });

    it('should correctly handle multi-party loans with negative amounts without inverting roles', () => {
        const entries: Entry[] = [
            // Bob borrows 100 from Alice (legacy/edited loan format with negative amount)
            {
                id: 1,
                amount: '-100.00',
                description: 'Emergency Cash Loan',
                created_at: new Date().toISOString(),
                username: 'Bob',
                user_id: 2,
                split_with_user_ids: [1],
                payer_shares: [{ userId: 2, percentage: 100 }], // borrower
                beneficiary_shares: [{ userId: 1, percentage: 100 }] // lender
            }
        ];

        const stats = calculateRoomStats(entries, members);
        expect(stats).not.toBeNull();

        expect(stats!.totalExpenses).toBe(0);
        expect(stats!.totalLoans).toBe(100);

        const alice = stats!.memberContributions.get(1)!;
        const bob = stats!.memberContributions.get(2)!;

        // Lender Alice: provided 100, net +100
        expect(alice.paid).toBe(100);
        expect(alice.share).toBe(0);
        expect(alice.net).toBe(100);

        // Borrower Bob: received 100, net -100
        expect(bob.paid).toBe(0);
        expect(bob.share).toBe(100);
        expect(bob.net).toBe(-100);
    });

    it('should satisfy conservation of money (sum of all net balances must equal 0)', () => {
        const entries: Entry[] = [
            {
                id: 1,
                amount: '250.75',
                description: 'Hotel Booking',
                created_at: new Date().toISOString(),
                username: 'Alice',
                user_id: 1,
                split_with_user_ids: [1, 2, 3],
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 33.333333 },
                    { userId: 2, percentage: 33.333333 },
                    { userId: 3, percentage: 33.333334 }
                ]
            },
            {
                id: 2,
                amount: '45.20',
                description: 'Snacks',
                created_at: new Date().toISOString(),
                username: 'Bob',
                user_id: 2,
                split_with_user_ids: [2, 3],
                payer_shares: [{ userId: 2, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 2, percentage: 50 },
                    { userId: 3, percentage: 50 }
                ]
            },
            {
                id: 3,
                amount: '30.00',
                description: 'Settle up',
                created_at: new Date().toISOString(),
                username: 'Charlie',
                user_id: 3,
                split_with_user_ids: [1],
                payer_shares: [{ userId: 3, percentage: 100 }],
                beneficiary_shares: [{ userId: 1, percentage: 100 }]
            }
        ];

        const stats = calculateRoomStats(entries, members);
        expect(stats).not.toBeNull();

        let sumNet = 0;
        stats!.memberContributions.forEach(m => {
            sumNet += m.net;
        });

        // Sum of all member nets must be 0
        expect(Math.abs(sumNet)).toBeLessThan(0.01);
    });
});
