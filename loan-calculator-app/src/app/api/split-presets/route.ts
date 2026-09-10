import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { resolveRoomId } from '@/lib/room-resolver';

interface ShareItem {
  userId: number;
  percentage: number;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawRoomId = searchParams.get('roomId');

    if (rawRoomId) {
      const resolvedRoomId = await resolveRoomId(db, rawRoomId);
      if (!resolvedRoomId) {
        return NextResponse.json({ message: 'Room not found' }, { status: 404 });
      }

      // Ensure user is member of room
      const memberCheck = await db.query(
        'SELECT can_view FROM room_members WHERE room_id = $1 AND user_id = $2',
        [resolvedRoomId, user.userId]
      );
      if (memberCheck.rows.length === 0 || !memberCheck.rows[0].can_view) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }

      const res = await db.query(
        `SELECT id, name, room_id, shares, created_at, updated_at
         FROM split_presets
         WHERE user_id = $1 AND room_id = $2
         ORDER BY id ASC`,
        [user.userId, resolvedRoomId]
      );
      return NextResponse.json(res.rows);
    }

    // If no room specified, return all presets belonging to this user
    const res = await db.query(
      `SELECT id, name, room_id, shares, created_at, updated_at
       FROM split_presets
       WHERE user_id = $1
       ORDER BY id ASC`,
      [user.userId]
    );
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Failed to fetch split presets:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roomId: rawRoomId, name, shares } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ message: 'Preset name is required' }, { status: 400 });
    }

    if (!Array.isArray(shares) || shares.length === 0) {
      return NextResponse.json({ message: 'Shares must be a non-empty array' }, { status: 400 });
    }

    // Validate share items
    for (const item of shares as ShareItem[]) {
      if (typeof item.userId !== 'number' || typeof item.percentage !== 'number' || isNaN(item.percentage) || item.percentage < 0) {
        return NextResponse.json({ message: 'Invalid share items' }, { status: 400 });
      }
    }

    const trimmedName = name.trim().slice(0, 255);

    let resolvedRoomId: number | null = null;
    if (rawRoomId !== undefined && rawRoomId !== null && rawRoomId !== '') {
      resolvedRoomId = await resolveRoomId(db, rawRoomId);
      if (!resolvedRoomId) {
        return NextResponse.json({ message: 'Room not found' }, { status: 404 });
      }

      // Check membership
      const memberCheck = await db.query(
        'SELECT can_view FROM room_members WHERE room_id = $1 AND user_id = $2',
        [resolvedRoomId, user.userId]
      );
      if (memberCheck.rows.length === 0 || !memberCheck.rows[0].can_view) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    const insertRes = await db.query(
      `INSERT INTO split_presets (user_id, room_id, name, shares)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, room_id, name, shares, created_at, updated_at`,
      [user.userId, resolvedRoomId, trimmedName, JSON.stringify(shares)]
    );

    return NextResponse.json(insertRes.rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create split preset:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const presetId = idParam ? parseInt(idParam, 10) : null;

    if (!presetId || isNaN(presetId)) {
      return NextResponse.json({ message: 'Invalid preset ID' }, { status: 400 });
    }

    const deleteRes = await db.query(
      `DELETE FROM split_presets
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [presetId, user.userId]
    );

    if (deleteRes.rows.length === 0) {
      return NextResponse.json({ message: 'Preset not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: presetId });
  } catch (error) {
    console.error('Failed to delete split preset:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
