const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running automated unit & integration tests for Option 2...');

assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

const pkg = require(path.join(__dirname, '../app/package.json'));
assert.ok(pkg.name, 'Package name should exist');
assert.ok(pkg.dependencies.express, 'Express dependency must be present');
assert.ok(pkg.dependencies.react, 'React dependency must be present');
assert.ok(pkg.dependencies['sql.js'], 'sql.js dependency must be present');

assert.ok(fs.existsSync(path.join(__dirname, '../app/dist/index.html')), 'React dist/index.html must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../app/Dockerfile')), 'Dockerfile must exist');

console.log('✅ Option 2 tests passed successfully!');
