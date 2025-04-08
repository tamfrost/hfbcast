#!/usr/bin/env node

const packageJson = require('../package.json');

if (process.argv[2] === 'version') {
    process.stdout.write(packageJson['version']);
}

if (process.argv[2] === 'namespace') {
    process.stdout.write(packageJson['name'].startsWith('@') ? packageJson['name'].split('/')[0] : '');
}

if (process.argv[2] === 'name') {
    process.stdout.write(packageJson['name'].startsWith('@') ? packageJson['name'].split('/')[1] : packageJson['name']);
}
