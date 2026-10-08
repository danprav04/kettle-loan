import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { verifyToken } from '../../../../lib/auth';

export async function GET(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const result = await db.query(
            `SELECT settings FROM user_customizations WHERE user_id = $1`,
            [user.userId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({});
        }

        return NextResponse.json(result.rows[0].settings || {});
    } catch (error) {
        console.error('Failed to fetch user customizations:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        if (typeof body !== 'object' || body === null) {
            return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
        }

        const result = await db.query(
            `INSERT INTO user_customizations (user_id, settings, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
             RETURNING settings`,
            [user.userId, JSON.stringify(body)]
        );

        return NextResponse.json(result.rows[0]?.settings || {});
    } catch (error) {
        console.error('Failed to update user customizations:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}
