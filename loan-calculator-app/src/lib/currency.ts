/**
 * Currency Exchange Rate Service
 * 
 * Provides robust exchange rate fetching with multi-provider fallback:
 * 1. Primary: Frankfurter API (ECB data, free, no key)
 * 2. Secondary: ExchangeRate.fun (free, no key, 170+ currencies)
 * 3. Tertiary: In-memory cache of last successful fetch
 * 
 * Cache is bounded to MAX_CACHE_ENTRIES base currencies to prevent memory growth.
 */

// ---------------------------------------------------------------------------
// Supported currencies — the single source of truth for the whole app
// ---------------------------------------------------------------------------

export interface CurrencyInfo {
    code: string;
    name: string;
    symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
    { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'THB', name: 'Thai Baht', symbol: '฿' },
    { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
];

const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

// ---------------------------------------------------------------------------
// Cache — bounded, in-memory, per-base-currency
// ---------------------------------------------------------------------------

interface CacheEntry {
    rates: Record<string, number>;
    fetchedAt: number; // epoch ms
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 20; // hard cap — we only have ~15 currencies anyway

const rateCache = new Map<string, CacheEntry>();

function getCached(base: string): Record<string, number> | null {
    const entry = rateCache.get(base);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
        return entry.rates;
    }
    // Expired but still usable as a last-resort fallback
    return null;
}

function getStaleCache(base: string): Record<string, number> | null {
    return rateCache.get(base)?.rates ?? null;
}

function setCache(base: string, rates: Record<string, number>): void {
    // Evict oldest entry if we're at the cap
    if (rateCache.size >= MAX_CACHE_ENTRIES && !rateCache.has(base)) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of rateCache) {
            if (entry.fetchedAt < oldestTime) {
                oldestTime = entry.fetchedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) rateCache.delete(oldestKey);
    }
    rateCache.set(base, { rates, fetchedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Provider 1: Frankfurter (ECB data)
 * https://frankfurter.dev
 * Supports ~33 currencies, free, no key required.
 * Note: ECB does not publish ILS rates directly, but Frankfurter derives them.
 */
async function fetchFromFrankfurter(base: string): Promise<Record<string, number>> {
    const url = `https://api.frankfurter.dev/v1/latest?base=${base}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
        throw new Error(`Frankfurter responded ${res.status}`);
    }
    const data = await res.json();
    // data.rates is { "USD": 3.72, "EUR": 3.98, ... }  (does not include the base itself)
    const rates: Record<string, number> = { [base]: 1, ...data.rates };
    return rates;
}

/**
 * Provider 2: ExchangeRate.fun
 * https://api.exchangerate.fun
 * Supports 170+ currencies, hourly updates, free, no key.
 */
async function fetchFromExchangeRateFun(base: string): Promise<Record<string, number>> {
    const url = `https://api.exchangerate.fun/latest?base=${base}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
        throw new Error(`ExchangeRate.fun responded ${res.status}`);
    }
    const data = await res.json();
    // data.rates is { "USD": 3.72, ... }
    const rates: Record<string, number> = { [base]: 1, ...data.rates };
    return rates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExchangeRatesResult {
    rates: Record<string, number>;
    lastUpdated: number;
    isStale: boolean;
}

export interface ExchangeRateResult {
    rate: number;
    lastUpdated: number;
    isStale: boolean;
}

/**
 * Get all exchange rates relative to `base` (with metadata), trying providers in order
 * with fallback to cache.
 */
export async function getExchangeRatesDetails(base: string): Promise<ExchangeRatesResult> {
    if (!SUPPORTED_CODES.has(base)) {
        throw new Error(`Unsupported currency: ${base}`);
    }

    // 1. Check fresh cache
    const cachedEntry = rateCache.get(base);
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < CACHE_TTL_MS) {
        return { rates: cachedEntry.rates, lastUpdated: cachedEntry.fetchedAt, isStale: false };
    }

    // 2. Try providers in order
    const providers = [fetchFromFrankfurter, fetchFromExchangeRateFun];
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const rates = await provider(base);
            setCache(base, rates);
            const newEntry = rateCache.get(base)!;
            return { rates: newEntry.rates, lastUpdated: newEntry.fetchedAt, isStale: false };
        } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
        }
    }

    // 3. Fall back to stale cache
    if (cachedEntry) {
        console.warn(
            `[currency] All providers failed for base=${base}, using stale cache. Errors: ${errors.join('; ')}`
        );
        return { rates: cachedEntry.rates, lastUpdated: cachedEntry.fetchedAt, isStale: true };
    }

    // 4. No cache, no providers — hard fail
    throw new Error(
        `Failed to fetch exchange rates for ${base}. All providers failed: ${errors.join('; ')}. No cached rates available.`
    );
}

/**
 * Get the exchange rate to convert 1 unit of `from` into `to` (with metadata).
 */
export async function getExchangeRateDetails(from: string, to: string): Promise<ExchangeRateResult> {
    if (from === to) return { rate: 1, lastUpdated: Date.now(), isStale: false };
    const details = await getExchangeRatesDetails(from);
    const rate = details.rates[to];
    if (rate === undefined) {
        throw new Error(`Exchange rate not available for ${from} → ${to}`);
    }
    return { rate, lastUpdated: details.lastUpdated, isStale: details.isStale };
}

/**
 * Get all exchange rates relative to `base` (legacy wrapper)
 */
export async function getExchangeRates(base: string): Promise<Record<string, number>> {
    const details = await getExchangeRatesDetails(base);
    return details.rates;
}

/**
 * Get the exchange rate to convert 1 unit of `from` into `to` (legacy wrapper)
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
    const details = await getExchangeRateDetails(from, to);
    return details.rate;
}
