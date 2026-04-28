#!/usr/bin/env node
/**
 * Patches @expo/cli prebuildAsync to skip the interactive dependency
 * install prompt in CI environments. Runs automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');

const prebuildFile = path.join(
  __dirname, '..', 'node_modules', '@expo', 'cli',
  'build', 'src', 'prebuild', 'prebuildAsync.js'
);

if (!fs.existsSync(prebuildFile)) {
  console.log('[patch-expo] File not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(prebuildFile, 'utf8');

if (content.includes('/* CI_PATCHED */')) {
  console.log('[patch-expo] Already patched, skipping.');
  process.exit(0);
}

// Replace the interactive confirmAsync block with an auto-yes
const original = 'if (await (0, _prompts.confirmAsync)({';
const patched  = 'if (/* CI_PATCHED */ true || await (0, _prompts.confirmAsync)({';

if (!content.includes(original)) {
  console.log('[patch-expo] Pattern not found — expo CLI version may differ. Skipping patch.');
  process.exit(0);
}

content = content.replace(original, patched);
fs.writeFileSync(prebuildFile, content, 'utf8');
console.log('[patch-expo] ✅ Patched expo prebuild — dependency prompt will auto-accept.');
