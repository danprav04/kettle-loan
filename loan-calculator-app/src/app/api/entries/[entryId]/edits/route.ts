import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(
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

        const editsQuery = await db.query(`
            SELECT ee.*, u.username as edited_by_username
            FROM entry_edits ee
            LEFT JOIN users u ON ee.edited_by_user_id = u.id
            WHERE ee.entry_id = $1
            ORDER BY ee.edited_at DESC
        `, [numericEntryId]);

        return NextResponse.json(editsQuery.rows);
    } catch (error) {
        console.error('Failed to fetch entry edits:', error);
        return NextResponse.json({ message: 'An error occurred.' }, { status: 500 });
    }
}
