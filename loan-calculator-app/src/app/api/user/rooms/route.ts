import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const roomsResult = await db.query(
            `SELECT r.id, r.code 
             FROM rooms r 
             JOIN room_members rm ON r.id = rm.room_id 
             WHERE rm.user_id = $1 
             ORDER BY r.created_at DESC`,
            [user.userId]
        );

        return NextResponse.json(roomsResult.rows);

    } catch (error) {
        console.error('Failed to fetch user rooms:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}