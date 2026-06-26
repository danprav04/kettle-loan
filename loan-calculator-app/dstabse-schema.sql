CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    last_ip VARCHAR(255)
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255),
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS'
);

CREATE TABLE room_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE(user_id, room_id)
);

CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    split_with_user_ids JSONB,
    payer_shares JSONB,
    beneficiary_shares JSONB,
    created_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entry_edits (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    edited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    old_amount NUMERIC(10, 2),
    new_amount NUMERIC(10, 2),
    old_description VARCHAR(255),
    new_description VARCHAR(255),
    old_payer_shares JSONB,
    new_payer_shares JSONB,
    old_beneficiary_shares JSONB,
    new_beneficiary_shares JSONB,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_entry_edits_entry_id ON entry_edits(entry_id);

CREATE TABLE push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    locale VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_push_subs_user_id ON push_subscriptions(user_id);

CREATE TABLE schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);