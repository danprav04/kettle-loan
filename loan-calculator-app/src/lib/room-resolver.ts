export async function resolveRoomId(db: any, roomIdParam: string | number): Promise<number | null> {
    if (typeof roomIdParam === 'number') return roomIdParam;
    const str = String(roomIdParam).trim();
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }
    const res = await db.query('SELECT id FROM rooms WHERE UPPER(code) = UPPER($1)', [str]);
    if (res.rows.length > 0) {
        return res.rows[0].id;
    }
    return null;
}
