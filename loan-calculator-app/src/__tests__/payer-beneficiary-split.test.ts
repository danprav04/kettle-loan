import { describe, it, expect } from 'vitest';
import { rebalanceSharesWithLocks, ShareItem } from '../lib/split-calc';

describe('rebalanceSharesWithLocks', () => {
  it('returns empty array when target user list is empty', () => {
    const result = rebalanceSharesWithLocks([], new Set([1]), [{ userId: 1, percentage: 100 }]);
    expect(result.nextShares).toEqual([]);
    expect(result.nextLocked.size).toBe(0);
  });

  describe('When no members are locked (equal split mode)', () => {
    it('recalculates 100% equally among remaining members when removing a member (4 to 3)', () => {
      const currentShares: ShareItem[] = [
        { userId: 1, percentage: 25 },
        { userId: 2, percentage: 25 },
        { userId: 3, percentage: 25 },
        { userId: 4, percentage: 25 },
      ];
      const locked = new Set<number>();

      // Remove user 1 -> [2, 3, 4]
      const result = rebalanceSharesWithLocks([2, 3, 4], locked, currentShares);

      expect(result.nextShares).toHaveLength(3);
      const sum = result.nextShares.reduce((a, b) => a + b.percentage, 0);
      expect(sum).toBe(100);

      expect(result.nextShares[0].percentage).toBe(33.333334);
      expect(result.nextShares[1].percentage).toBe(33.333333);
      expect(result.nextShares[2].percentage).toBe(33.333333);
      expect(result.nextLocked.size).toBe(0);
    });

    it('recalculates 100% equally among remaining members when removing from 3 to 2', () => {
      const currentShares: ShareItem[] = [
        { userId: 2, percentage: 33.333334 },
        { userId: 3, percentage: 33.333333 },
        { userId: 4, percentage: 33.333333 },
      ];
      const locked = new Set<number>();

      // Remove user 2 -> [3, 4]
      const result = rebalanceSharesWithLocks([3, 4], locked, currentShares);

      expect(result.nextShares).toHaveLength(2);
      expect(result.nextShares[0].percentage).toBe(50);
      expect(result.nextShares[1].percentage).toBe(50);
    });

    it('gives 100% when reduced to 1 member', () => {
      const currentShares: ShareItem[] = [
        { userId: 3, percentage: 50 },
        { userId: 4, percentage: 50 },
      ];
      const locked = new Set<number>();

      const result = rebalanceSharesWithLocks([4], locked, currentShares);

      expect(result.nextShares).toHaveLength(1);
      expect(result.nextShares[0]).toEqual({ userId: 4, percentage: 100 });
    });

    it('recalculates 100% equally when adding a member (3 to 4)', () => {
      const currentShares: ShareItem[] = [
        { userId: 2, percentage: 33.333334 },
        { userId: 3, percentage: 33.333333 },
        { userId: 4, percentage: 33.333333 },
      ];
      const locked = new Set<number>();

      // Add user 1 -> [2, 3, 4, 1]
      const result = rebalanceSharesWithLocks([2, 3, 4, 1], locked, currentShares);

      expect(result.nextShares).toHaveLength(4);
      result.nextShares.forEach((s) => {
        expect(s.percentage).toBe(25);
      });
      const sum = result.nextShares.reduce((a, b) => a + b.percentage, 0);
      expect(sum).toBe(100);
    });
  });

  describe('When some members have custom typed amounts (locked)', () => {
    it('preserves custom locked sum and spreads remaining total among unlocked members when removing an unlocked member', () => {
      // User 1 customly typed 40% (locked). Users 2 & 3 have 30% each (unlocked).
      const currentShares: ShareItem[] = [
        { userId: 1, percentage: 40 },
        { userId: 2, percentage: 30 },
        { userId: 3, percentage: 30 },
      ];
      const locked = new Set<number>([1]);

      // Remove unlocked user 3 -> [1, 2]
      const result = rebalanceSharesWithLocks([1, 2], locked, currentShares);

      expect(result.nextShares).toHaveLength(2);
      expect(result.nextShares.find((s) => s.userId === 1)?.percentage).toBe(40);
      expect(result.nextShares.find((s) => s.userId === 2)?.percentage).toBe(60);
      expect(result.nextLocked.has(1)).toBe(true);
      expect(result.nextLocked.size).toBe(1);

      const sum = result.nextShares.reduce((a, b) => a + b.percentage, 0);
      expect(sum).toBe(100);
    });

    it('preserves custom locked sum and spreads remaining total among unlocked members when adding a member', () => {
      // User 1 locked at 40%. User 2 unlocked at 60%.
      const currentShares: ShareItem[] = [
        { userId: 1, percentage: 40 },
        { userId: 2, percentage: 60 },
      ];
      const locked = new Set<number>([1]);

      // Add user 3 -> [1, 2, 3]
      const result = rebalanceSharesWithLocks([1, 2, 3], locked, currentShares);

      expect(result.nextShares).toHaveLength(3);
      expect(result.nextShares.find((s) => s.userId === 1)?.percentage).toBe(40);
      expect(result.nextShares.find((s) => s.userId === 2)?.percentage).toBe(30);
      expect(result.nextShares.find((s) => s.userId === 3)?.percentage).toBe(30);
      expect(result.nextLocked.has(1)).toBe(true);

      const sum = result.nextShares.reduce((a, b) => a + b.percentage, 0);
      expect(sum).toBe(100);
    });

    it('clears lock and redistributes remaining total when a locked member is removed', () => {
      // User 1 locked at 40%. Users 2 & 3 unlocked at 30% each.
      const currentShares: ShareItem[] = [
        { userId: 1, percentage: 40 },
        { userId: 2, percentage: 30 },
        { userId: 3, percentage: 30 },
      ];
      const locked = new Set<number>([1]);

      // Remove locked user 1 -> [2, 3]
      const result = rebalanceSharesWithLocks([2, 3], locked, currentShares);

      expect(result.nextShares).toHaveLength(2);
      expect(result.nextShares.find((s) => s.userId === 2)?.percentage).toBe(50);
      expect(result.nextShares.find((s) => s.userId === 3)?.percentage).toBe(50);
      expect(result.nextLocked.size).toBe(0);

      const sum = result.nextShares.reduce((a, b) => a + b.percentage, 0);
      expect(sum).toBe(100);
    });

    it('preserves all custom amounts when all remaining members are locked', () => {
      // User 1 locked at 40%, User 2 locked at 35%, User 3 unlocked at 25%
      const currentShares: ShareItem[] = [
        { userId: 1, percentage: 40 },
        { userId: 2, percentage: 35 },
        { userId: 3, percentage: 25 },
      ];
      const locked = new Set<number>([1, 2]);

      // Remove user 3 -> [1, 2]
      const result = rebalanceSharesWithLocks([1, 2], locked, currentShares);

      expect(result.nextShares).toHaveLength(2);
      expect(result.nextShares.find((s) => s.userId === 1)?.percentage).toBe(40);
      expect(result.nextShares.find((s) => s.userId === 2)?.percentage).toBe(35);
      expect(result.nextLocked.has(1)).toBe(true);
      expect(result.nextLocked.has(2)).toBe(true);
    });
  });
});
