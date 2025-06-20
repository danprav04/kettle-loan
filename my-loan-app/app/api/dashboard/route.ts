import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
    const tokenPayload = await verifyToken();
    if (!tokenPayload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = tokenPayload.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                rooms: {
                    include: {
                        room: {
                            include: {
                                users: {
                                    include: {
                                        user: {
                                            select: { id: true, username: true }
                                        }
                                    }
                                },
                                entries: {
                                    include: {
                                        user: {
                                            select: { id: true, username: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        // Exclude password and IP
        const { password, signupIP, ...userData } = user;

        return NextResponse.json(userData);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}