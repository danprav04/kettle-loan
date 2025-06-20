import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    const tokenPayload = await verifyToken();
    if (!tokenPayload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, description, roomId } = await req.json();
    const userId = tokenPayload.userId;

    if (!amount || !description || !roomId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const entry = await prisma.entry.create({
            data: {
                amount: parseFloat(amount),
                description,
                roomId,
                userId,
            },
        });
        return NextResponse.json(entry);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to add entry' }, { status: 500 });
    }
}