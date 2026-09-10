'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FiLoader } from 'react-icons/fi';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { handleApi } from '@/lib/api';

export interface CurrencyAmountInputProps {
  id?: string;
  amount: string;
  onAmountChange: (amount: string) => void;
  roomCurrency: string;
  inputCurrency: string;
  onInputCurrencyChange: (currency: string) => void;
  appendToDescription?: boolean;
  onAppendToDescriptionChange?: (append: boolean) => void;
  onConversionChange?: (conversion: {
    convertedAmount: number;
    rate: number | null;
    rateLastUpdated: number | null;
    rateIsStale: boolean;
    isRateLoading: boolean;
    isRateReady: boolean;
  }) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  showAppendToggle?: boolean;
}

const LOCAL_STORAGE_RATE_PREFIX = 'loan_app_rate_';

function getCachedRate(from: string, to: string): { rate: number; lastUpdated: number; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_RATE_PREFIX}${from}_${to}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.rate === 'number' && typeof parsed?.lastUpdated === 'number') {
      return {
        rate: parsed.rate,
        lastUpdated: parsed.lastUpdated,
        isStale: true, // assume stale until revalidated
      };
    }
  } catch {
    // Ignore JSON or storage errors
  }
  return null;
}

function setCachedRate(from: string, to: string, data: { rate: number; lastUpdated: number }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_RATE_PREFIX}${from}_${to}`,
      JSON.stringify(data)
    );
  } catch {
    // Ignore storage quota errors
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  const dateStr = date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

export default function CurrencyAmountInput({
  id = 'amount',
  amount,
  onAmountChange,
  roomCurrency,
  inputCurrency,
  onInputCurrencyChange,
  appendToDescription = true,
  onAppendToDescriptionChange,
  onConversionChange,
  disabled = false,
  placeholder = '0.00',
  autoFocus = false,
  showAppendToggle = true,
}: CurrencyAmountInputProps) {
  const t = useTranslations('Room');

  const [rate, setRate] = useState<number | null>(null);
  const [rateLastUpdated, setRateLastUpdated] = useState<number | null>(null);
  const [rateIsStale, setRateIsStale] = useState<boolean>(false);
  const [isRateLoading, setIsRateLoading] = useState<boolean>(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const isDifferentCurrency = inputCurrency.toUpperCase() !== roomCurrency.toUpperCase();

  // Exchange rate fetching & caching
  useEffect(() => {
    if (!isDifferentCurrency) {
      setRate(1);
      setRateLastUpdated(null);
      setRateIsStale(false);
      setIsRateLoading(false);
      setRateError(null);
      return;
    }

    const from = inputCurrency.toUpperCase();
    const to = roomCurrency.toUpperCase();

    // Check local storage cache first
    const cached = getCachedRate(from, to);
    if (cached) {
      setRate(cached.rate);
      setRateLastUpdated(cached.lastUpdated);
      setRateIsStale(true);
    } else {
      setRate(null);
      setRateLastUpdated(null);
      setRateIsStale(false);
    }

    let isCancelled = false;
    setIsRateLoading(true);
    setRateError(null);

    handleApi({ url: `/api/currency?from=${from}&to=${to}`, method: 'GET' })
      .then((res) => {
        if (isCancelled) return;
        if (typeof res?.rate === 'number') {
          const fetchedRate = res.rate;
          const updatedTime = res.lastUpdated || Date.now();
          const stale = Boolean(res.isStale);

          setRate(fetchedRate);
          setRateLastUpdated(updatedTime);
          setRateIsStale(stale);
          setRateError(null);

          setCachedRate(from, to, { rate: fetchedRate, lastUpdated: updatedTime });
        } else {
          throw new Error('Invalid rate response');
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        if (!cached) {
          setRateError(err instanceof Error ? err.message : 'Failed to fetch rate');
          setRate(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsRateLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [inputCurrency, roomCurrency, isDifferentCurrency]);

  // Calculate converted amount
  const parsedAmount = parseFloat(amount);
  const safeAmount = isNaN(parsedAmount) ? 0 : Math.max(0, parsedAmount);

  const convertedAmount = useMemo(() => {
    if (!isDifferentCurrency) return safeAmount;
    if (rate === null) return 0;
    return Math.round(safeAmount * rate * 100) / 100;
  }, [isDifferentCurrency, safeAmount, rate]);

  const isRateReady = !isDifferentCurrency || (rate !== null && !isRateLoading);

  // Notify parent component of conversion state
  const prevConversionRef = useRef<string>('');
  useEffect(() => {
    if (!onConversionChange) return;
    const currentKey = `${convertedAmount}_${rate}_${rateLastUpdated}_${rateIsStale}_${isRateLoading}_${isRateReady}`;
    if (prevConversionRef.current !== currentKey) {
      prevConversionRef.current = currentKey;
      onConversionChange({
        convertedAmount,
        rate: isDifferentCurrency ? rate : 1,
        rateLastUpdated,
        rateIsStale,
        isRateLoading,
        isRateReady,
      });
    }
  }, [
    convertedAmount,
    rate,
    rateLastUpdated,
    rateIsStale,
    isRateLoading,
    isRateReady,
    isDifferentCurrency,
    onConversionChange,
  ]);

  // Ensure roomCurrency is present in the list even if not in SUPPORTED_CURRENCIES
  const currencyOptions = useMemo(() => {
    const list = [...SUPPORTED_CURRENCIES];
    const exists = list.some((c) => c.code.toUpperCase() === roomCurrency.toUpperCase());
    if (!exists && roomCurrency) {
      list.unshift({ code: roomCurrency.toUpperCase(), name: roomCurrency.toUpperCase(), symbol: roomCurrency.toUpperCase() });
    }
    return list;
  }, [roomCurrency]);

  return (
    <div className="w-full space-y-1.5">
      {/* Label with directional indicator */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-muted-foreground text-xs font-bold tracking-wide uppercase"
        >
          {t('amount')} ({inputCurrency})
        </label>
        {isDifferentCurrency && (
          <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 flex items-center gap-1">
            <span>→</span>
            <span>{roomCurrency}</span>
          </span>
        )}
      </div>

      {/* Input row: Amount Input + Currency Select */}
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={amount}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            if (/^\d*\.?\d*$/.test(e.target.value)) {
              onAmountChange(e.target.value);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 leading-tight rounded-xl themed-input font-bold text-base min-w-0"
          required
        />

        <select
          value={inputCurrency}
          onChange={(e) => onInputCurrencyChange(e.target.value)}
          disabled={disabled}
          aria-label="Select currency"
          className="shrink-0 px-2 py-2 text-xs font-bold rounded-xl border border-input bg-card text-foreground cursor-pointer themed-input shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {currencyOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Conversion Banner: Rate info, converted preview, and toggle */}
      {isDifferentCurrency && (
        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs animate-fadeIn space-y-2 shadow-sm">
          {/* Converted Preview */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium text-[11px]">{t('convertedAmount')}:</span>
            <span className="font-bold text-primary text-sm tracking-tight">
              ≈ {convertedAmount.toFixed(2)} {roomCurrency}
            </span>
          </div>

          {/* Rate status & timestamp */}
          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground flex-wrap gap-1">
            {isRateLoading && rate === null ? (
              <span className="inline-flex items-center gap-1">
                <FiLoader className="animate-spin text-[10px]" />
                {t('fetchingRate')}
              </span>
            ) : rate !== null ? (
              <>
                <span className="font-semibold text-foreground/80">
                  1 {inputCurrency} = {rate} {roomCurrency}
                </span>
                {rateLastUpdated && (
                  <span>
                    {rateIsStale
                      ? t('cachedRateAsOf', { time: formatTimestamp(rateLastUpdated) })
                      : t('liveRateAsOf', { time: formatTimestamp(rateLastUpdated) })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-amber-500 font-medium">
                {t('rateUnavailable')}
              </span>
            )}
          </div>

          {/* Description append toggle (ON by default) */}
          {showAppendToggle && onAppendToDescriptionChange && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-muted-foreground hover:text-foreground pt-1.5 border-t border-border/40">
              <input
                type="checkbox"
                checked={appendToDescription}
                onChange={(e) => onAppendToDescriptionChange(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
              />
              <span>{t('appendNoteToDescription')}</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
