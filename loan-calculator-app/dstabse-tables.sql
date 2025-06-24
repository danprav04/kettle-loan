CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    last_ip VARCHAR(255)
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    -- If the creator's user account is deleted, we set this to NULL
    -- rather than deleting the whole room.
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE room_members (
    id SERIAL PRIMARY KEY,
    -- If a user is deleted, remove them from all rooms.
    -- If a room is deleted, remove all members from it.
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE(user_id, room_id)
);

CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    -- If a room is deleted, all its financial entries are also deleted.
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    -- If a user is deleted, their financial entries are also deleted.
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    -- This column stores an array of user IDs with whom an expense is shared.
    split_with_user_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);