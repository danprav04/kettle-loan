import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(req: Request) {
    const tokenPayload = await verifyToken();
    if (!tokenPayload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomCode } = await req.json();
    const userId = tokenPayload.userId;

    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    const isUserInRoom = await prisma.usersOnRooms.findFirst({
        where: { roomId: room.id, userId: userId }
    });

    if (isUserInRoom) {
         return NextResponse.json({ error: 'Already in room' }, { status: 400 });
    }

    try {
        await prisma.usersOnRooms.create({
            data: {
                roomId: room.id,
                userId: userId,
            },
        });
        return NextResponse.json(room);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }
}