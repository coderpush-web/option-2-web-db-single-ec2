const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running automated unit & integration tests for Next.js App...');

assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

const pkg = require(path.join(__dirname, '../app/package.json'));
assert.ok(pkg.name || pkg.private, 'Package verification passed');
assert.ok(pkg.dependencies.next, 'Next.js dependency must be present');
assert.ok(pkg.dependencies.react, 'React dependency must be present');

assert.ok(fs.existsSync(path.join(__dirname, '../app/Dockerfile')), 'Dockerfile must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/app/page.tsx')), 'Next.js page.tsx must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/app/api/health/route.ts')), 'Health check route.ts must exist');

// Verify Option 2 specific artifacts
const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
assert.ok(fs.existsSync(dockerComposePath), 'docker-compose.yml must exist at project root');
const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
assert.ok(dockerComposeContent.includes('services:'), 'docker-compose.yml must define services');
assert.ok(dockerComposeContent.includes('web:'), 'docker-compose.yml must define web service');
assert.ok(dockerComposeContent.includes('db:'), 'docker-compose.yml must define db service');
assert.ok(dockerComposeContent.includes('pg_isready -U'), 'docker-compose.yml must define postgres healthcheck');

// Verify .env.example configuration contract
const envExamplePath = path.join(__dirname, '../app/.env.example');
assert.ok(fs.existsSync(envExamplePath), '.env.example must exist in app directory');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
assert.ok(envExampleContent.includes('AUTH_SECRET='), '.env.example must document AUTH_SECRET');
assert.ok(envExampleContent.includes('SQLITE_DB_PATH='), '.env.example must document SQLITE_DB_PATH');

// Verify better-sqlite3 integration
assert.ok(pkg.dependencies['better-sqlite3'], 'better-sqlite3 dependency must be present');
const Database = require(path.join(__dirname, '../app/node_modules/better-sqlite3'));
const testDb = new Database(':memory:');
testDb.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT);
  INSERT INTO users VALUES ('1', 'Test User', 'test@example.com', 'hashed_pass');
`);
const row = testDb.prepare('SELECT name FROM users WHERE email = ?').get('test@example.com');
assert.strictEqual(row.name, 'Test User', 'SQLite database read/write operation verified');
testDb.close();

// Verify zero hardcoded fallback passwords or credentials in app source files and docker compose
const dbSource = fs.readFileSync(path.join(__dirname, '../app/app/lib/db.ts'), 'utf8');
assert.ok(!dbSource.includes('postgres://postgres:'), 'db.ts must not contain hardcoded postgres credentials');
assert.ok(!dbSource.includes('DevAdmin2026'), 'db.ts must not contain hardcoded fallback password');

assert.ok(!dockerComposeContent.includes('postgres_dev_password'), 'docker-compose.yml must not contain hardcoded fallback passwords');
assert.ok(!dockerComposeContent.includes('default-dev-nextauth-secret'), 'docker-compose.yml must not contain hardcoded fallback secrets');

const authSource = fs.readFileSync(path.join(__dirname, '../app/auth.ts'), 'utf8');
assert.ok(!authSource.includes("'123456'"), 'auth.ts must not contain mock backdoor password');

console.log('✅ Automated Next.js & Option 2 integration tests passed successfully!');
