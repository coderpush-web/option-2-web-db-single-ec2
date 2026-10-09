const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = process.env.PORT || 80;

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER || 'appuser';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'appdb';
const APP_ENV = process.env.APP_ENV || 'Production';

let dbPool = null;
if (DB_HOST) {
  dbPool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 5000
  });
}

app.get('/health', async (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', async (req, res) => {
  let dbStatus = 'Not Configured (Standalone Mode)';
  let dbError = null;

  if (dbPool) {
    try {
      const [rows] = await dbPool.query('SELECT 1 + 1 AS solution, NOW() as current_time');
      dbStatus = `Connected to ${DB_HOST} successfully (Result: ${rows[0].solution}, Time: ${rows[0].current_time})`;
    } catch (err) {
      dbStatus = `Connection Failed: ${err.message}`;
      dbError = err.stack;
    }
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>AWS Deployment Demonstration</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #f4f6f8; color: #232f3e; }
      .card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 650px; margin: 0 auto; }
      h1 { color: #ff9900; margin-top: 0; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; background: #0073bb; color: white; }
      .status { padding: 12px; border-radius: 4px; margin: 16px 0; background: ${dbStatus.includes('Connected') || dbStatus.includes('Standalone') ? '#e7f4e8' : '#fde8e8'}; color: ${dbStatus.includes('Connected') || dbStatus.includes('Standalone') ? '#1e7e34' : '#bd2130'}; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      td, th { padding: 8px; border-bottom: 1px solid #eee; text-align: left; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>🚀 AWS CloudFormation Demo App</h1>
      <span class="badge">Environment: ${APP_ENV}</span>
      <div class="status">
        <strong>Database Status:</strong> ${dbStatus}
      </div>
      <table>
        <tr><th>Hostname / Server IP</th><td>${require('os').hostname()}</td></tr>
        <tr><th>Platform</th><td>Node.js ${process.version}</td></tr>
        <tr><th>Configured DB Host</th><td>${DB_HOST || 'None'}</td></tr>
        <tr><th>Database Name</th><td>${DB_NAME || 'None'}</td></tr>
      </table>
    </div>
  </body>
  </html>
  `;
  res.send(html);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
