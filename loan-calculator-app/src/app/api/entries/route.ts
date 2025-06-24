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

        const { roomId, amount, description, splitWithUserIds } = await req.json();

        // For expenses, splitWithUserIds will be an array of user IDs.
        // We must manually stringify it for the JSONB column.
        // For loans, it will be null.
        const finalSplitWith = Array.isArray(splitWithUserIds) ? JSON.stringify(splitWithUserIds) : null;

        await db.query(
            'INSERT INTO entries (room_id, user_id, amount, description, split_with_user_ids) VALUES ($1, $2, $3, $4, $5)',
            [roomId, user.userId, amount, description, finalSplitWith]
        );

        return NextResponse.json({ message: 'Entry added successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}