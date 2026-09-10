import { describe, it, expect } from 'vitest';
import { SplitPreset, SplitPresetShare } from '../lib/hooks/useSplitPresets';

// Helper that mirrors the preset application and normalization logic from PayerBeneficiarySelector
export function applyPresetToEligible(
  preset: SplitPreset,
  eligibleUserIds: number[]
): SplitPresetShare[] {
  const eligibleSet = new Set(eligibleUserIds);
  const matched = preset.shares.filter((s) => eligibleSet.has(s.userId));

  if (matched.length === 0) return [];

  const sumPct = matched.reduce((acc, s) => acc + s.percentage, 0);
  if (sumPct <= 0) {
    const count = matched.length;
    const basePct = Math.floor((100 / count) * 1e6) / 1e6;
    const rem = Math.round((100 - basePct * count) * 1e6) / 1e6;
    return matched.map((s, idx) => ({
      userId: s.userId,
      percentage: idx === 0 ? Math.round((basePct + rem) * 1e6) / 1e6 : basePct,
    }));
  }

  const factor = 100 / sumPct;
  const nextShares = matched.map((s) => ({
    userId: s.userId,
    percentage: Math.round(s.percentage * factor * 1e6) / 1e6,
  }));

  const totalPct = nextShares.reduce((acc, s) => acc + s.percentage, 0);
  const diffPct = Math.round((100 - totalPct) * 1e6) / 1e6;
  if (nextShares.length > 0 && Math.abs(diffPct) > 1e-8) {
    nextShares[0].percentage = Math.round((nextShares[0].percentage + diffPct) * 1e6) / 1e6;
  }

  return nextShares;
}

describe('Split Presets Normalization and Application', () => {
  it('applies a preset directly when all preset members are eligible', () => {
    const preset: SplitPreset = {
      id: 1,
      name: '60/40 Split',
      shares: [
        { userId: 1, percentage: 60 },
        { userId: 2, percentage: 40 },
      ],
    };

    const result = applyPresetToEligible(preset, [1, 2, 3]);
    expect(result).toHaveLength(2);
    expect(result.find((s) => s.userId === 1)?.percentage).toBe(60);
    expect(result.find((s) => s.userId === 2)?.percentage).toBe(40);
    const sum = result.reduce((acc, s) => acc + s.percentage, 0);
    expect(sum).toBe(100);
  });

  it('normalizes percentages proportionally when one member is no longer eligible', () => {
    const preset: SplitPreset = {
      id: 2,
      name: '3-way split',
      shares: [
        { userId: 1, percentage: 50 },
        { userId: 2, percentage: 25 },
        { userId: 3, percentage: 25 }, // Member 3 removed from room
      ],
    };

    // Only user 1 and 2 are eligible
    const result = applyPresetToEligible(preset, [1, 2]);
    expect(result).toHaveLength(2);

    // Sum should equal 100%
    const sum = result.reduce((acc, s) => acc + s.percentage, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(1e-5);

    // Ratio between user 1 and user 2 was 50:25 (2:1), so new values are 66.666667% and 33.333333%
    const u1 = result.find((s) => s.userId === 1)?.percentage || 0;
    const u2 = result.find((s) => s.userId === 2)?.percentage || 0;
    expect(u1).toBeCloseTo(66.666667, 4);
    expect(u2).toBeCloseTo(33.333333, 4);
    expect(u1 + u2).toBe(100);
  });

  it('returns empty array when none of the preset members are eligible', () => {
    const preset: SplitPreset = {
      id: 3,
      name: 'Old members',
      shares: [
        { userId: 10, percentage: 50 },
        { userId: 11, percentage: 50 },
      ],
    };

    const result = applyPresetToEligible(preset, [1, 2, 3]);
    expect(result).toEqual([]);
  });

  it('correctly handles 3-way equal splits ensuring sum is exactly 100 with remainder', () => {
    const preset: SplitPreset = {
      id: 4,
      name: 'Equal 3',
      shares: [
        { userId: 1, percentage: 33.333333 },
        { userId: 2, percentage: 33.333333 },
        { userId: 3, percentage: 33.333334 },
      ],
    };

    const result = applyPresetToEligible(preset, [1, 2, 3]);
    const sum = result.reduce((acc, s) => acc + s.percentage, 0);
    expect(sum).toBe(100);
  });
});
