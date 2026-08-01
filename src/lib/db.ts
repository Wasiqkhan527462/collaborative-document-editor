import { Pool } from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// We allow missing connectionString so the build doesn't fail, but queries will fail.
const pool = new Pool({
  connectionString: connectionString || 'postgres://postgres:postgres@localhost:5432/postgres',
  ssl: process.env.NODE_ENV === 'production' && connectionString && connectionString.includes('vercel-storage.com') ? { rejectUnauthorized: false } : undefined
});

export async function initDb() {
  if (!connectionString) {
    console.warn('No POSTGRES_URL or DATABASE_URL provided. Database initialization skipped.');
    return;
  }
  
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        owner_id TEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS document_shares (
        document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL DEFAULT 'editor',
        PRIMARY KEY (document_id, user_id),
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        created_at BIGINT NOT NULL,
        created_by TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS active_sessions (
        document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_seen BIGINT NOT NULL,
        PRIMARY KEY (document_id, user_id),
        FOREIGN KEY (document_id) REFERENCES documents(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Add permission column if it doesn't exist (graceful migration)
    try {
      await client.query("ALTER TABLE document_shares ADD COLUMN permission TEXT NOT NULL DEFAULT 'editor'");
    } catch (e) {
      // Column already exists or table not created yet, safe to ignore
    }

    // Seed initial users if they don't exist
    const seedUsers = [
      { id: 'user-1', name: 'User 1' },
      { id: 'user-2', name: 'Wasiq' },
      { id: 'user-3', name: 'Alice' }
    ];

    for (const user of seedUsers) {
      await client.query(
        'INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
        [user.id, user.name]
      );
    }
  } finally {
    client.release();
  }
}

// Ensure the db is initialized
initDb().catch(console.error);

export default pool;
