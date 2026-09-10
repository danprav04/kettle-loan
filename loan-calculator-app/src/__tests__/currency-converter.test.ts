import { describe, it, expect, beforeEach } from 'vitest';

describe('Currency Converter Logic', () => {
  const calculateConvertedAmount = (amountStr: string, rate: number | null, isDifferent: boolean): number => {
    const parsed = parseFloat(amountStr);
    const safeAmount = isNaN(parsed) ? 0 : Math.max(0, parsed);
    if (!isDifferent) return safeAmount;
    if (rate === null) return 0;
    return Math.round(safeAmount * rate * 100) / 100;
  };

  const formatDescriptionWithRate = (
    originalDescription: string,
    amountStr: string,
    currency: string,
    rate: number | null,
    appendToDescription: boolean,
    isDifferent: boolean
  ): string => {
    const trimmed = originalDescription.trim();
    if (!isDifferent || !appendToDescription || !rate) {
      return trimmed;
    }
    const parsed = parseFloat(amountStr);
    const safeAmount = isNaN(parsed) ? 0 : parsed;
    return `${trimmed} (${safeAmount.toFixed(2)} ${currency} @ ${rate})`;
  };

  describe('Conversion calculation & rounding', () => {
    it('should convert foreign currency amount to room currency correctly', () => {
      const converted = calculateConvertedAmount('100', 3.6521, true);
      expect(converted).toBe(365.21);
    });

    it('should round to 2 decimal places accurately', () => {
      const converted = calculateConvertedAmount('33.33', 1.0855, true);
      // 33.33 * 1.0855 = 36.179715 -> 36.18
      expect(converted).toBe(36.18);
    });

    it('should return exact same amount when input and room currencies are identical', () => {
      const converted = calculateConvertedAmount('150.75', 1, false);
      expect(converted).toBe(150.75);
    });

    it('should handle invalid or zero amount gracefully', () => {
      expect(calculateConvertedAmount('', 3.5, true)).toBe(0);
      expect(calculateConvertedAmount('abc', 3.5, true)).toBe(0);
      expect(calculateConvertedAmount('0', 3.5, true)).toBe(0);
    });
  });

  describe('Description formatting with exchange rate', () => {
    it('should append original currency and rate when toggle is enabled and currencies differ', () => {
      const result = formatDescriptionWithRate(
        'Dinner in NYC',
        '100.5',
        'USD',
        3.6521,
        true,
        true
      );
      expect(result).toBe('Dinner in NYC (100.50 USD @ 3.6521)');
    });

    it('should keep original description unmodified when toggle is disabled', () => {
      const result = formatDescriptionWithRate(
        'Dinner in NYC',
        '100.5',
        'USD',
        3.6521,
        false,
        true
      );
      expect(result).toBe('Dinner in NYC');
    });

    it('should keep original description unmodified when currencies are the same', () => {
      const result = formatDescriptionWithRate(
        'Lunch at cafe',
        '50',
        'ILS',
        1,
        true,
        false
      );
      expect(result).toBe('Lunch at cafe');
    });
  });

  describe('Multi-party percentage split with converted total', () => {
    it('should cleanly split converted amounts across participants', () => {
      // User inputs 100 USD in an ILS room with rate 3.6521
      const totalILS = calculateConvertedAmount('100', 3.6521, true); // 365.21
      const shares = [
        { userId: 1, percentage: 50 },
        { userId: 2, percentage: 50 },
      ];

      const splitAmounts = shares.map((s) => Math.round((totalILS * s.percentage) / 100 * 100) / 100);
      expect(splitAmounts[0]).toBe(182.61);
      expect(splitAmounts[1]).toBe(182.61);
      // The sum is 365.22, within standard 1 cent multi-party delta
      expect(Math.abs(splitAmounts[0] + splitAmounts[1] - totalILS)).toBeCloseTo(0.01, 2);
    });
  });
});
