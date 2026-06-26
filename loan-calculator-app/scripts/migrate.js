// scripts/migrate.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn('POSTGRES_URL environment variable is not set. Skipping migrations.');
    process.exit(0);
  }

  const pool = new Pool({
    connectionString,
  });

  const client = await pool.connect();

  try {
    console.log('Checking schema_migrations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Skipping.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const res = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (res.rows.length === 0) {
        console.log(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Successfully applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Error applying migration ${file}:`, err);
          throw err;
        }
      } else {
        console.log(`Migration ${file} already applied. Skipping.`);
      }
    }
    console.log('All migrations completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
