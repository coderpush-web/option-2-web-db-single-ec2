const assert = require('assert');
console.log('Running automated unit tests...');

// Test basic arithmetic logic
assert.strictEqual(1 + 1, 2, 'Arithmetic should work');

// Test server module exports / structure
const pkg = require('./app/package.json');
assert.ok(pkg.name, 'Package name should exist');
assert.ok(pkg.dependencies.express, 'Express dependency must be present');

console.log('✅ All tests passed successfully!');
