import { describe, it, expect } from 'vitest';
import { calculateAllMemberBalances, BalanceCalcMember, BalanceCalcEntry } from '../lib/balance-calc';

describe('Participant Filtering and Balance Calculations', () => {
    const members: BalanceCalcMember[] = [
        { id: 1, username: 'Alice', role: 'admin', can_participate: true, permissions: { canParticipate: true } },
        { id: 2, username: 'Bob', role: 'member', can_participate: true, permissions: { canParticipate: true } },
        { id: 3, username: 'Charlie', role: 'member', can_participate: false, permissions: { canParticipate: false } },
        { id: 4, username: 'Dave', role: 'observer' }
    ];

    it('should exclude non-participating members and observers when splitting among eligible members', () => {
        const entries: BalanceCalcEntry[] = [
            {
                amount: 100,
                user_id: 1,
                split_with_user_ids: null // Should split among calcMembers (Alice and Bob)
            }
        ];

        const balances = calculateAllMemberBalances(entries, members);

        // Alice paid 100, and split is between Alice (50) and Bob (50)
        // Alice net = +50, Bob net = -50
        // Charlie and Dave should be 0 because they cannot participate
        expect(balances[1]).toBe(50);
        expect(balances[2]).toBe(-50);
        expect(balances[3]).toBe(0);
        expect(balances[4]).toBe(0);
    });

    it('should respect custom shares if a non-participating member had prior historical shares', () => {
        const entries: BalanceCalcEntry[] = [
            {
                amount: 100,
                user_id: 1,
                payer_shares: [{ userId: 1, percentage: 100 }],
                beneficiary_shares: [
                    { userId: 1, percentage: 50 },
                    { userId: 3, percentage: 50 } // Charlie previously had 50% share before being turned off
                ]
            }
        ];

        const balances = calculateAllMemberBalances(entries, members);

        expect(balances[1]).toBe(50);
        expect(balances[3]).toBe(-50);
        expect(balances[2]).toBe(0);
        expect(balances[4]).toBe(0);
    });
});
