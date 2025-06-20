import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST() {
    const tokenPayload = await verifyToken();
    if (!tokenPayload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = tokenPayload.userId;
    const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();

    let roomCode = generateRoomCode();
    let room = await prisma.room.findUnique({ where: { code: roomCode } });

    while (room) {
        roomCode = generateRoomCode();
        room = await prisma.room.findUnique({ where: { code: roomCode } });
    }

    try {
        const newRoom = await prisma.room.create({
            data: {
                code: roomCode,
                users: {
                    create: {
                        userId: userId
                    }
                }
            },
        });
        return NextResponse.json(newRoom);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }
}