#!/usr/bin/env node
/**
 * Patches @expo/cli prebuildAsync to skip the interactive dependency
 * install prompt in CI environments. Runs automatically via postinstall.
 */
const fs   = require('fs');
const path = require('path');

// Locate the @expo/cli package dynamically so it works in any pnpm layout
let cliRoot;
try {
  // This resolves to the main entry point; we navigate up to the package root
  cliRoot = path.dirname(require.resolve('@expo/cli/package.json'));
} catch (e) {
  console.log('[patch-expo] @expo/cli not found, skipping patch.');
  process.exit(0);
}

const prebuildFile = path.join(cliRoot, 'build', 'src', 'prebuild', 'prebuildAsync.js');

if (!fs.existsSync(prebuildFile)) {
  console.log('[patch-expo] prebuildAsync.js not found at:', prebuildFile);
  process.exit(0);
}

let content = fs.readFileSync(prebuildFile, 'utf8');

if (content.includes('/* CI_PATCHED */')) {
  console.log('[patch-expo] Already patched, skipping.');
  process.exit(0);
}

const original = 'if (await (0, _prompts.confirmAsync)({';
const patched  = 'if (/* CI_PATCHED */ true || await (0, _prompts.confirmAsync)({';

if (!content.includes(original)) {
  // Try alternate pattern (newer expo versions)
  const alt = 'if (await confirmAsync({';
  if (content.includes(alt)) {
    content = content.replace(alt, 'if (/* CI_PATCHED */ true || confirmAsync({');
    fs.writeFileSync(prebuildFile, content, 'utf8');
    console.log('[patch-expo] ✅ Patched (alt pattern):', prebuildFile);
    process.exit(0);
  }
  console.log('[patch-expo] Pattern not found — skipping.');
  process.exit(0);
}

content = content.replace(original, patched);
fs.writeFileSync(prebuildFile, content, 'utf8');
console.log('[patch-expo] ✅ Patched:', prebuildFile);
