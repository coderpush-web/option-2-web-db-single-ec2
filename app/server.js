const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const port = process.env.PORT || 80;
const APP_ENV = process.env.APP_ENV || 'Production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'app.sqlite');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'Normal',
        created_at TEXT NOT NULL
      );
    `);
    db.run("INSERT INTO tasks (title, priority, created_at) VALUES ('Initialize SQLite DB schema', 'High', datetime('now'));");
    db.run("INSERT INTO tasks (title, priority, created_at) VALUES ('Docker containerization & ECR push', 'High', datetime('now'));");
    saveDB();
  }
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: APP_ENV, db: 'sqlite' });
});

app.get('/api/tasks', (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB not ready' });
  const results = db.exec("SELECT * FROM tasks ORDER BY id DESC;");
  let tasks = [];
  if (results.length > 0) {
    const columns = results[0].columns;
    tasks = results[0].values.map(row => {
      let obj = {};
      columns.forEach((col, idx) => obj[col] = row[idx]);
      return obj;
    });
  }
  res.json({
    tasks,
    dbInfo: {
      type: 'SQLite3 (Embedded)',
      path: dbPath,
      env: APP_ENV,
      totalRows: tasks.length
    }
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.run("INSERT INTO tasks (title, priority, created_at) VALUES (?, ?, ?);", [title, priority || 'Normal', now]);
  saveDB();
  res.status(201).json({ status: 'created' });
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM tasks WHERE id = ?;", [id]);
  saveDB();
  res.json({ status: 'deleted' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initDB().then(() => {
  app.listen(port, () => {
    console.log(`TaskOrbit Web Server running on port ${port} in ${APP_ENV} mode with SQLite`);
  });
});
