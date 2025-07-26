import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function DELETE(
    req: Request,
    { params }: { params: { entryId: string } }
) {
    try {
        const { entryId } = params;
        const numericEntryId = parseInt(entryId, 10);

        if (isNaN(numericEntryId)) {
            return NextResponse.json({ message: 'Invalid Entry ID' }, { status: 400 });
        }

        const token = req.headers.get('authorization')?.split(' ')[1];
        const user = verifyToken(token);
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // To ensure data integrity, we get the entry details before deleting
        const entryQuery = await db.query('SELECT user_id FROM entries WHERE id = $1', [numericEntryId]);

        if (entryQuery.rows.length === 0) {
            // If the entry is already gone, we can treat it as a success.
            // This makes the client-side logic simpler if a delete request is sent twice.
            return new NextResponse(null, { status: 204 });
        }
        
        const entry = entryQuery.rows[0];

        if (entry.user_id !== user.userId) {
            // The user trying to delete the entry is not the creator.
            return NextResponse.json({ message: 'Forbidden: You can only delete your own entries.' }, { status: 403 });
        }

        // Proceed with deletion
        await db.query(
            'DELETE FROM entries WHERE id = $1',
            [numericEntryId]
        );

        return new NextResponse(null, { status: 204 }); // Success, no content
    } catch (error) {
        console.error('Failed to delete entry:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}