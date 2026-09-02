import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_CURRENCIES, getExchangeRateDetails } from '@/lib/currency';

/**
 * GET /api/currency
 * 
 * Query params:
 *   - from & to: optional, returns the exchange rate for that pair
 * 
 * Always returns the list of supported currencies.
 * If from & to are provided, also returns the current rate.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from')?.toUpperCase();
    const to = searchParams.get('to')?.toUpperCase();

    const response: {
        currencies: typeof SUPPORTED_CURRENCIES;
        rate?: number;
        from?: string;
        to?: string;
        lastUpdated?: number;
        isStale?: boolean;
    } = {
        currencies: SUPPORTED_CURRENCIES,
    };

    if (from && to && from !== to) {
        try {
            const details = await getExchangeRateDetails(from, to);
            response.rate = Math.round(details.rate * 10000) / 10000; // 4 decimal places
            response.from = from;
            response.to = to;
            response.lastUpdated = details.lastUpdated;
            response.isStale = details.isStale;
        } catch (err) {
            return NextResponse.json(
                { 
                    message: err instanceof Error ? err.message : 'Failed to fetch exchange rate',
                    currencies: SUPPORTED_CURRENCIES 
                },
                { status: 503 }
            );
        }
    }

    return NextResponse.json(response);
}
