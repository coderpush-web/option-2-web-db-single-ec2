const assert = require('assert');
const path = require('path');
console.log('Running automated unit tests...');

// 1. Logic assertions
assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

// 2. Package verification
const pkg = require(path.join(__dirname, '../app/package.json'));
assert.ok(pkg.name, 'Package name should exist');
assert.ok(pkg.dependencies.express, 'Express dependency must be present');

console.log('✅ All unit tests passed successfully!');
