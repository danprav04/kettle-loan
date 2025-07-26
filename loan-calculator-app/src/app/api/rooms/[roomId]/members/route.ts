import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const client = await db.connect();
    try {
        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { roomId } = await params;

        if (!roomId || isNaN(parseInt(roomId, 10))) {
            return NextResponse.json({ message: 'Invalid Room ID' }, { status: 400 });
        }
        const numericRoomId = parseInt(roomId, 10);
        
        await client.query('BEGIN');

        const deleteResult = await client.query(
            'DELETE FROM room_members WHERE user_id = $1 AND room_id = $2',
            [user.userId, numericRoomId]
        );

        if (deleteResult.rowCount === 0) {
            await client.query('COMMIT');
            return NextResponse.json({ message: 'User already not in room' });
        }

        await client.query(
            'UPDATE rooms SET creator_id = NULL WHERE id = $1 AND creator_id = $2',
            [numericRoomId, user.userId]
        );

        const membersResult = await client.query(
            'SELECT 1 FROM room_members WHERE room_id = $1 LIMIT 1',
            [numericRoomId]
        );

        if (membersResult.rows.length === 0) {
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