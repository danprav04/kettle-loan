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

        const subscription = await req.json();
        const { endpoint, keys } = subscription;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            console.error("Invalid subscription data:", subscription);
            return NextResponse.json({ message: 'Invalid subscription data' }, { status: 400 });
        }

        // Upsert subscription
        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (endpoint) 
             DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = CURRENT_TIMESTAMP`,
            [user.userId, endpoint, keys.p256dh, keys.auth]
        );

        return NextResponse.json({ message: 'Subscribed successfully' });
    } catch (error) {
        console.error('SERVER ERROR in /api/notifications/subscribe:', error);
        return NextResponse.json({ message: 'Internal server error', error: String(error) }, { status: 500 });
    }
}