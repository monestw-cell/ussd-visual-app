#!/usr/bin/env node
/**
 * Two-pronged CI fix for Expo prebuild interactive prompt:
 *
 * 1) Patch @expo/cli prebuildAsync.js: short-circuit the "Install
 *    updated dependencies?" prompt so it never runs (deps are already
 *    installed by pnpm).
 * 2) Wrap the local `expo` bin so any `prebuild` invocation gets
 *    `--no-install` injected automatically — defence in depth in case
 *    the patch above doesn't apply (e.g. different file layout).
 *
 * Runs from the workspace-root postinstall so it's guaranteed to fire
 * after every `pnpm install`, regardless of which package the install
 * was launched from.
 */
const fs   = require('fs');
const path = require('path');

// ---- 1) Patch prebuildAsync.js -------------------------------------------

function patchPrebuild() {
  // Try multiple strategies to locate @expo/cli
  let cliRoot;
  const tryPaths = [
    path.join(__dirname, '..', 'node_modules', '@expo', 'cli'),
    path.join(__dirname, '..', '..', '..', 'node_modules', '@expo', 'cli'),
  ];

  try {
    cliRoot = path.dirname(require.resolve('@expo/cli/package.json', {
      paths: [path.join(__dirname, '..')],
    }));
  } catch (e) {
    for (const p of tryPaths) {
      if (fs.existsSync(path.join(p, 'package.json'))) { cliRoot = p; break; }
    }
  }

  if (!cliRoot) {
    console.log('[patch-expo] @expo/cli not found via any strategy.');
    return;
  }

  const prebuildFile = path.join(cliRoot, 'build', 'src', 'prebuild', 'prebuildAsync.js');
  if (!fs.existsSync(prebuildFile)) {
    console.log('[patch-expo] prebuildAsync.js missing at', prebuildFile);
    return;
  }

  let content = fs.readFileSync(prebuildFile, 'utf8');
  if (content.includes('/* CI_PATCHED */')) {
    console.log('[patch-expo] prebuildAsync.js already patched.');
    return;
  }

  const original = 'if (await (0, _prompts.confirmAsync)({';
  const patched  = 'if (/* CI_PATCHED */ false && await (0, _prompts.confirmAsync)({';

  if (content.includes(original)) {
    content = content.replace(original, patched);
    fs.writeFileSync(prebuildFile, content, 'utf8');
    console.log('[patch-expo] ✅ Patched prebuildAsync.js');
  } else {
    console.log('[patch-expo] confirmAsync pattern not found — file may have changed');
  }
}

// ---- 2) Wrap the expo bin -----------------------------------------------

function wrapExpoBin() {
  // Find expo bin in the ussd-app's local .bin folder
  const ussdAppDir = path.join(__dirname, '..');
  const binDir = path.join(ussdAppDir, 'node_modules', '.bin');
  const expoBin = path.join(binDir, 'expo');

  if (!fs.existsSync(binDir)) {
    console.log('[wrap-expo] .bin dir not found at', binDir);
    return;
  }
  if (!fs.existsSync(expoBin)) {
    console.log('[wrap-expo] expo bin not found, skipping wrapper');
    return;
  }

  // Read the current bin to see if already wrapped
  const cur = fs.readFileSync(expoBin, 'utf8');
  if (cur.includes('# CI_WRAPPED')) {
    console.log('[wrap-expo] expo bin already wrapped.');
    return;
  }

  // Resolve the real expo CLI entry point that the original bin calls
  let realCliPath;
  try {
    realCliPath = require.resolve('@expo/cli/build/bin/cli', {
      paths: [ussdAppDir],
    });
  } catch (e) {
    console.log('[wrap-expo] cannot resolve @expo/cli bin:', e.message);
    return;
  }

  // Save the original bin for fallback
  if (!fs.existsSync(expoBin + '.orig')) {
    try { fs.copyFileSync(expoBin, expoBin + '.orig'); } catch {}
  }

  const wrapper = `#!/usr/bin/env node
// CI_WRAPPED — auto-adds --no-install to prebuild commands
const args = process.argv.slice(2);
if (args[0] === 'prebuild' && !args.includes('--no-install')) {
  args.push('--no-install');
  console.log('[wrap-expo] Injecting --no-install into prebuild');
}
process.argv = [process.argv[0], process.argv[1], ...args];
require(${JSON.stringify(realCliPath)});
`;

  // Symlinks must be replaced, not written
  try { fs.unlinkSync(expoBin); } catch {}
  fs.writeFileSync(expoBin, wrapper, { mode: 0o755 });
  console.log('[wrap-expo] ✅ Wrapped expo bin at', expoBin);
}

try { patchPrebuild(); } catch (e) { console.log('[patch-expo] error:', e.message); }
try { wrapExpoBin();    } catch (e) { console.log('[wrap-expo] error:', e.message); }
