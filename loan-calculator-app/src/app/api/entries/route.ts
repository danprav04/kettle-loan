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

        const { roomId, amount, description, splitWithUserIds, createdAt } = await req.json();

        // For expenses, splitWithUserIds will be an array of user IDs.
        // We must manually stringify it for the JSONB column.
        // For loans, it will be null.
        const finalSplitWith = Array.isArray(splitWithUserIds) ? JSON.stringify(splitWithUserIds) : null;
        
        // Use the client-provided timestamp if available, otherwise use the current time.
        // This ensures offline entries retain their original creation time.
        const finalCreatedAt = createdAt ? new Date(createdAt) : new Date();

        await db.query(
            'INSERT INTO entries (room_id, user_id, amount, description, split_with_user_ids, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [roomId, user.userId, amount, description, finalSplitWith, finalCreatedAt.toISOString()]
        );

        return NextResponse.json({ message: 'Entry added successfully' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}