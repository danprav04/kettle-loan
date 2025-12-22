import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendRoomNotification } from '@/lib/notifications';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ entryId: string }> }
) {
    try {
        const { entryId } = await params;
        const numericEntryId = parseInt(entryId, 10);

        if (isNaN(numericEntryId)) {
            return NextResponse.json({ message: 'Invalid Entry ID' }, { status: 400 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Fetch details necessary for permission check AND notification
        const entryQuery = await db.query(
            'SELECT user_id, room_id, description FROM entries WHERE id = $1', 
            [numericEntryId]
        );

        if (entryQuery.rows.length === 0) {
            return new NextResponse(null, { status: 204 });
        }
        
        const entry = entryQuery.rows[0];

        if (entry.user_id !== user.userId) {
            return NextResponse.json({ message: 'Forbidden: You can only delete your own entries.' }, { status: 403 });
        }

        await db.query(
            'DELETE FROM entries WHERE id = $1',
            [numericEntryId]
        );

        // Send Push Notification
        sendRoomNotification(entry.room_id, user.userId, {
            title: 'Entry Deleted',
            body: `${user.username} removed: ${entry.description}`,
            url: `/rooms/${entry.room_id}`
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Failed to delete entry:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}