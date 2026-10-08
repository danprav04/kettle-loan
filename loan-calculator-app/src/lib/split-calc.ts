export interface ShareItem {
  userId: number;
  percentage: number;
}

/**
 * Rebalances share percentages across target participants while preserving
 * any custom amounts (locks) entered by the user.
 *
 * - If no participants are locked, total 100% is split equally among all target participants.
 * - If some participants are locked, their percentages are preserved and the remaining
 *   percentage (max(0, 100 - sum(locked))) is divided equally among unlocked participants.
 * - If all target participants are locked, their percentages are preserved as-is.
 * - Floating point discrepancies (<= 0.05%) are absorbed into the first unlocked participant.
 */
export function rebalanceSharesWithLocks(
  targetUserIds: number[],
  currentLocked: Set<number>,
  currentShares: ShareItem[]
): { nextShares: ShareItem[]; nextLocked: Set<number> } {
  if (targetUserIds.length === 0) {
    return { nextShares: [], nextLocked: new Set() };
  }

  // Only retain locked IDs that are present in targetUserIds
  const nextLocked = new Set<number>();
  currentLocked.forEach((id) => {
    if (targetUserIds.includes(id)) {
      nextLocked.add(id);
    }
  });

  const lockedShares = currentShares.filter((s) => nextLocked.has(s.userId));
  const lockedPct = lockedShares.reduce((acc, s) => acc + s.percentage, 0);

  const unlockedUserIds = targetUserIds.filter((id) => !nextLocked.has(id));

  if (unlockedUserIds.length === 0) {
    // All remaining members are locked: keep existing shares
    return { nextShares: lockedShares, nextLocked };
  }

  const remainingPct = Math.max(0, 100 - lockedPct);
  const count = unlockedUserIds.length;
  const basePct = Math.floor((remainingPct / count) * 1e6) / 1e6;
  const remainder = Math.round((remainingPct - basePct * count) * 1e6) / 1e6;

  const nextShares: ShareItem[] = targetUserIds.map((id) => {
    if (nextLocked.has(id)) {
      const existing = lockedShares.find((s) => s.userId === id);
      return { userId: id, percentage: existing ? existing.percentage : 0 };
    }
    const unlockedIdx = unlockedUserIds.indexOf(id);
    return {
      userId: id,
      percentage: unlockedIdx === 0 ? Math.round((basePct + remainder) * 1e6) / 1e6 : basePct,
    };
  });

  // Fix floating point discrepancy on the first unlocked share if within 0.05%
  const totalPct = nextShares.reduce((acc, s) => acc + s.percentage, 0);
  const diffPct = Math.round((100 - totalPct) * 1e6) / 1e6;
  if (Math.abs(diffPct) > 1e-8 && Math.abs(diffPct) <= 0.05 && unlockedUserIds.length > 0) {
    const firstUnlockedId = unlockedUserIds[0];
    const targetItem = nextShares.find((s) => s.userId === firstUnlockedId);
    if (targetItem) {
      targetItem.percentage = Math.round((targetItem.percentage + diffPct) * 1e6) / 1e6;
    }
  }

  return { nextShares, nextLocked };
}
