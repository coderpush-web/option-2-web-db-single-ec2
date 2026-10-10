import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { invoices, customers, revenue, users } from './placeholder-data';

function getDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    const dir = path.dirname(process.env.SQLITE_DB_PATH);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Ignore if directory already exists or permissions
    }
    return process.env.SQLITE_DB_PATH;
  }

  // Attempt container standard path /app/data/app.db
  try {
    if (fs.existsSync('/app/data')) {
      return '/app/data/app.db';
    }
    if (fs.existsSync('/app')) {
      fs.mkdirSync('/app/data', { recursive: true });
      return '/app/data/app.db';
    }
  } catch {
    // Fall through to project-local or temp directory when running outside container
  }

  // Fallback to project-local data directory or /tmp
  try {
    const localDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'app.db');
  } catch {
    return path.join('/tmp', 'app.db');
  }
}

const dbPath = getDbPath();

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch {
  // directory might already exist
}

export const db = new Database(dbPath, { timeout: 10000 });
try {
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');
} catch (err) {
  // Already in WAL or concurrent process locking
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers (id)
    );

    CREATE TABLE IF NOT EXISTS revenue (
      month TEXT PRIMARY KEY,
      revenue INTEGER NOT NULL
    );
  `);

  // Initial seeding for users only if explicit password provided in environment
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const initialPassword = process.env.INITIAL_USER_PASSWORD || process.env.DEMO_USER_PASSWORD;
  if (userCount.count === 0 && initialPassword) {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password)
      VALUES (?, ?, ?, ?)
    `);
    const seedUsers = db.transaction(() => {
      const defaultHash = bcrypt.hashSync(initialPassword, 10);
      for (const u of users) {
        const hash = u.password ? bcrypt.hashSync(u.password, 10) : defaultHash;
        insertUser.run(u.id, u.name, u.email, hash);
      }
    });
    seedUsers();
  }

  // Initial seeding for customers
  const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (custCount.count === 0) {
    const insertCust = db.prepare(`
      INSERT OR IGNORE INTO customers (id, name, email, image_url)
      VALUES (?, ?, ?, ?)
    `);
    const seedCust = db.transaction(() => {
      for (const c of customers) {
        insertCust.run(c.id, c.name, c.email, c.image_url);
      }
    });
    seedCust();
  }

  // Initial seeding for invoices
  const invCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
  if (invCount.count === 0) {
    const insertInv = db.prepare(`
      INSERT OR IGNORE INTO invoices (id, customer_id, amount, status, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    const seedInv = db.transaction(() => {
      for (let idx = 0; idx < invoices.length; idx++) {
        const inv = invoices[idx] as any;
        const invId = inv.id || `inv-${idx + 1}`;
        insertInv.run(invId, inv.customer_id, inv.amount, inv.status, inv.date);
      }
    });
    seedInv();
  }

  // Initial seeding for revenue
  const revCount = db.prepare('SELECT COUNT(*) as count FROM revenue').get() as { count: number };
  if (revCount.count === 0) {
    const insertRev = db.prepare(`
      INSERT OR IGNORE INTO revenue (month, revenue)
      VALUES (?, ?)
    `);
    const seedRev = db.transaction(() => {
      for (const r of revenue) {
        insertRev.run(r.month, r.revenue);
      }
    });
    seedRev();
  }
}

// Automatically create schema and seed on initialization
try {
  initDatabase();
} catch (error) {
  console.error('Failed to auto-initialize SQLite database:', error);
}

export { invoices, customers, revenue };
