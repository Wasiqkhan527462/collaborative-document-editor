import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure the data directory exists
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = isProduction ? '/tmp' : path.join(process.cwd(), 'data');

if (!isProduction && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    owner_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
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
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS active_sessions (
    document_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_seen INTEGER NOT NULL,
    PRIMARY KEY (document_id, user_id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Graceful migration for existing DB
try {
  db.exec("ALTER TABLE document_shares ADD COLUMN permission TEXT NOT NULL DEFAULT 'editor'");
} catch (e) {
  // Column already exists or table not created yet, safe to ignore
}

// Seed initial users if they don't exist
const seedUsers = [
  { id: 'user-1', name: 'User 1' },
  { id: 'user-2', name: 'Wasiq' },
  { id: 'user-3', name: 'Alice' }
];

const insertUser = db.prepare('INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name');
const insertMany = db.transaction((users: typeof seedUsers) => {
  for (const user of users) {
    insertUser.run(user.id, user.name);
  }
});
insertMany(seedUsers);

export default db;
