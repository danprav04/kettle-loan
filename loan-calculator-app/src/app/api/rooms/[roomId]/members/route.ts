// src/app/api/rooms/[roomId]/members/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function DELETE(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    const client = await db.connect();
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { roomId } = params;

        if (!roomId || isNaN(parseInt(roomId, 10))) {
            return NextResponse.json({ message: 'Invalid Room ID' }, { status: 400 });
        }
        const numericRoomId = parseInt(roomId, 10);
        
        await client.query('BEGIN');

        // Remove the user from the room
        const deleteResult = await client.query(
            'DELETE FROM room_members WHERE user_id = $1 AND room_id = $2',
            [user.userId, numericRoomId]
        );

        if (deleteResult.rowCount === 0) {
            // The user wasn't a member of the room, so there's nothing to do.
            // We can consider this a successful state.
            await client.query('COMMIT');
            return NextResponse.json({ message: 'User already not in room' });
        }

        // Check if the user was the creator of the room. If so, nullify the creator_id.
        await client.query(
            'UPDATE rooms SET creator_id = NULL WHERE id = $1 AND creator_id = $2',
            [numericRoomId, user.userId]
        );

        // Check if there are any members left in the room
        const membersResult = await client.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 LIMIT 1',
            [numericRoomId]
        );

        if (membersResult.rows.length === 0) {
            // If no members are left, delete the entire room.
            // Entries will be deleted automatically due to `ON DELETE CASCADE`.
            await client.query('DELETE FROM rooms WHERE id = $1', [numericRoomId]);
        }
        
        await client.query('COMMIT');
        
        return NextResponse.json({ message: 'Successfully left the room' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to leave room:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    } finally {
        client.release();
    }
}