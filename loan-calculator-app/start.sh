#!/bin/sh
set -e

echo "Starting migration runner..."
node scripts/migrate.js

echo "Starting Next.js server..."
exec node server.js
