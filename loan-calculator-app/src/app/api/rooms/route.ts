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

        const { roomCode } = await req.json();

        if (roomCode) {
            // Join a room
            const roomResult = await db.query('SELECT id FROM rooms WHERE code = $1', [roomCode]);
            if (roomResult.rows.length === 0) {
                return NextResponse.json({ message: 'Room not found' }, { status: 404 });
            }
            const roomId = roomResult.rows[0].id;

            await db.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.userId, roomId]);

            return NextResponse.json({ roomId });
        } else {
            // Create a room
            const newCode = Math.random().toString().substring(2, 8);
            const roomResult = await db.query('INSERT INTO rooms (code, creator_id) VALUES ($1, $2) RETURNING id', [newCode, user.userId]);
            const roomId = roomResult.rows[0].id;

            await db.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)', [user.userId, roomId]);

            return NextResponse.json({ roomId, code: newCode });
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}