import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Safely parse body
        let subscription;
        try {
            subscription = await req.json();
        } catch (e) {
            console.error("Failed to parse subscription JSON:", e);
            return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
        }

        const { endpoint, keys, locale } = subscription || {};

        // Strict validation of required fields
        if (!endpoint || typeof endpoint !== 'string') {
            console.error("Subscription missing valid endpoint:", subscription);
            return NextResponse.json({ message: 'Invalid subscription endpoint' }, { status: 400 });
        }

        if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
            console.error("Subscription missing valid keys:", subscription);
            return NextResponse.json({ message: 'Invalid subscription keys' }, { status: 400 });
        }

        // Validate locale - default to 'en' if invalid
        const validLocales = ['en', 'he', 'ru'];
        const userLocale = validLocales.includes(locale) ? locale : 'en';

        // Verify user exists to prevent foreign key constraint violation
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [user.userId]);
        if (userCheck.rows.length === 0) {
             return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Upsert subscription
        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, locale) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (endpoint) 
             DO UPDATE SET 
                user_id = EXCLUDED.user_id, 
                p256dh = EXCLUDED.p256dh, 
                auth = EXCLUDED.auth,
                locale = EXCLUDED.locale,
                created_at = CURRENT_TIMESTAMP`,
            [user.userId, endpoint, String(keys.p256dh), String(keys.auth), userLocale]
        );

        return NextResponse.json({ message: 'Subscribed successfully' });
    } catch (error) {
        // Log the full error for server-side debugging, but return a clean JSON response
        console.error('SERVER ERROR in /api/notifications/subscribe:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { message: 'Internal server error processing subscription', error: errorMessage }, 
            { status: 500 }
        );
    }
}