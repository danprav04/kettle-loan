import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Define a type for the potential Postgres error to make our catch block type-safe
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

        let body = {};
        // The request might not have a body for create room, so we handle that case.
        try {
            const text = await req.text();
            if (text) {
              body = JSON.parse(text);
            }
        } catch {
            // Ignore error if body is empty or invalid, which is expected when creating a room.
        }
        const { roomCode } = body as { roomCode?: string };


        if (roomCode) {
            // Join an existing room
            const roomResult = await db.query('SELECT id FROM rooms WHERE code = $1', [roomCode]);
            if (roomResult.rows.length === 0) {
                // Using i18n key for consistency
                return NextResponse.json({ message: 'joinFailed' }, { status: 404 });
            }
            const roomId = roomResult.rows[0].id;

            // Use ON CONFLICT to gracefully handle cases where the user is already a member.
            await db.query('INSERT INTO room_members (user_id, room_id) VALUES ($1, $2) ON CONFLICT (user_id, room_id) DO NOTHING', [user.userId, roomId]);

            return NextResponse.json({ roomId });
        } else {
            // Create a new room with retry logic to ensure the generated code is unique.
            const MAX_RETRIES = 5;
            for (let i = 0; i < MAX_RETRIES; i++) {
                // Generate a 6-character alphanumeric code.
                const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                const client = await db.connect();
                try {
                    // Start a transaction
                    await client.query('BEGIN');

                    const roomResult = await client.query(
                        'INSERT INTO rooms (code, creator_id) VALUES ($1, $2) RETURNING id',
                        [newCode, user.userId]
                    );
                    const roomId = roomResult.rows[0].id;

                    // Add the creator as the first member of the new room.
                    await client.query(
                        'INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)',
                        [user.userId, roomId]
                    );

                    // Commit the transaction
                    await client.query('COMMIT');

                    // Successfully created room, return the details.
                    return NextResponse.json({ roomId, code: newCode }, { status: 201 });
                } catch (e: unknown) {
                    // Rollback the transaction in case of an error
                    await client.query('ROLLBACK');

                    const error = e as PostgresError;
                    // Check if the error is a unique violation on the room code.
                    if (error.code === '23505' && error.constraint === 'rooms_code_key') {
                        console.warn(`Attempt ${i + 1}: Duplicate room code generated ('${newCode}'). Retrying...`);
                        // The loop will continue to the next iteration to try a new code.
                    } else {
                        // For any other database error, re-throw it to be caught by the outer handler.
                        throw error;
                    }
                } finally {
                    client.release();
                }
            }
            // If the loop completes without returning, it means we failed to generate a unique code.
            console.error(`Failed to create a room after ${MAX_RETRIES} attempts due to duplicate codes.`);
            return NextResponse.json({ message: 'createFailed' }, { status: 500 });
        }
    } catch (error) {
        console.error('An error occurred in /api/rooms:', error);
        // Generic error for the client. The details are logged on the server.
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}