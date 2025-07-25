import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface PostgresError extends Error {
    code?: string;
    constraint?: string;
}

export async function POST(req: Request) {
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Try to parse the body. If it's empty or malformed, default to an empty object.
        const body = await req.json().catch(() => ({}));
        
        // Check if the intent is to JOIN a room.
        // This is true if 'roomCode' is a property in the body.
        if (typeof body.roomCode === 'string') {
            const roomCode = body.roomCode.trim().toUpperCase();

            // Explicitly block empty room codes.
            if (!roomCode) {
                 return NextResponse.json({ message: 'joinFailed' }, { status: 400 }); // Bad Request
            }

            const roomResult = await db.query('SELECT id FROM rooms WHERE code = $1', [roomCode]);
            if (roomResult.rows.length === 0) {
                return NextResponse.json({ message: 'joinFailed' }, { status: 404 });
            }
            const roomId = roomResult.rows[0].id;

            await db.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2) ON CONFLICT (user_id, room_id) DO NOTHING', [user.userId, roomId]);
            return NextResponse.json({ roomId });

        } else {
            // Intent is to CREATE a new room.
            const MAX_RETRIES = 5;
            for (let i = 0; i < MAX_RETRIES; i++) {
                const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                const client = await db.connect();
                try {
                    await client.query('BEGIN');
                    const roomResult = await client.query(
                        'INSERT INTO rooms (code, creator_id) VALUES ($1, $2) RETURNING id',
                        [newCode, user.userId]
                    );
                    const roomId = roomResult.rows[0].id;

                    await client.query(
                        'INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)',
                        [user.userId, roomId]
                    );

                    await client.query('COMMIT');
                    return NextResponse.json({ roomId, code: newCode }, { status: 201 });
                } catch (e: unknown) {
                    await client.query('ROLLBACK');
                    const error = e as PostgresError;
                    if (error.code === '23505' && error.constraint === 'rooms_code_key') {
                        console.warn(`Attempt ${i + 1}: Duplicate room code generated ('${newCode}'). Retrying...`);
                    } else {
                        throw error;
                    }
                } finally {
                    client.release();
                }
            }
            console.error(`Failed to create a room after ${MAX_RETRIES} attempts due to duplicate codes.`);
            return NextResponse.json({ message: 'createFailed' }, { status: 500 });
        }
    } catch (error) {
        console.error('An error occurred in /api/rooms:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}