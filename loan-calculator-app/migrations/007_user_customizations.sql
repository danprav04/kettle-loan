-- migrations/007_user_customizations.sql
-- Create table for storing per-user customization settings and custom labels

CREATE TABLE IF NOT EXISTS user_customizations (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
