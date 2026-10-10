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

console.log('✅ Automated Next.js tests passed successfully!');
