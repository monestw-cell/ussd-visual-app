#!/usr/bin/env node
/**
 * CI fix for `expo prebuild` interactive prompt.
 *
 * Strategy: patch the small `expo/bin/cli` entrypoint (one line:
 * `require('@expo/cli')`) to inject `--no-install` into argv whenever the
 * command is `prebuild`. This is safer than replacing `.bin/expo` (which
 * is a shell wrapper that sets up NODE_PATH for pnpm and must NOT be
 * replaced).
 *
 * Also patches @expo/cli's prebuildAsync.js as defence-in-depth so that
 * if --no-install slips through, the interactive prompt is still
 * short-circuited.
 *
 * Runs from the workspace-root postinstall, so it fires after every
 * `pnpm install`, no matter which package the install was launched from.
 */
const fs   = require('fs');
const path = require('path');

const ussdAppDir = path.join(__dirname, '..');

function resolveFrom(spec) {
  try {
    return require.resolve(spec, { paths: [ussdAppDir] });
  } catch {
    return null;
  }
}

// ---- 1) Restore .bin/expo if a previous version of this script wrapped it
function restoreBin() {
  const binPath  = path.join(ussdAppDir, 'node_modules', '.bin', 'expo');
  const origPath = binPath + '.orig';
  try {
    if (fs.existsSync(origPath)) {
      try { fs.unlinkSync(binPath); } catch {}
      fs.renameSync(origPath, binPath);
      console.log('[restore-bin] Restored .bin/expo from .orig backup');
    }
  } catch (e) {
    console.log('[restore-bin] error:', e.message);
  }
}

// ---- 2) Patch expo/bin/cli (the tiny entrypoint)
function patchExpoBinCli() {
  const cliEntry = resolveFrom('expo/bin/cli');
  if (!cliEntry) {
    console.log('[patch-bin-cli] expo/bin/cli not found.');
    return;
  }
  let content = fs.readFileSync(cliEntry, 'utf8');
  if (content.includes('CI_INJECT_NO_INSTALL')) {
    console.log('[patch-bin-cli] already patched.');
    return;
  }
  // Original content: `require('@expo/cli');` (with shebang line above)
  const injection = `
// CI_INJECT_NO_INSTALL — add --no-install to prebuild calls in CI
(function(){
  const a = process.argv.slice(2);
  if (a[0] === 'prebuild' && !a.includes('--no-install')) {
    process.argv.push('--no-install');
    console.log('[ci-inject] Added --no-install to prebuild');
  }
})();
`;
  // Insert injection just before the require('@expo/cli') line
  const target = "require('@expo/cli');";
  if (!content.includes(target)) {
    console.log('[patch-bin-cli] target line not found — file may have changed.');
    return;
  }
  content = content.replace(target, injection + target);
  fs.writeFileSync(cliEntry, content, 'utf8');
  console.log('[patch-bin-cli] ✅ Patched', cliEntry);
}

// ---- 3) Defence in depth: short-circuit the install prompt in @expo/cli
function patchPrebuildAsync() {
  const pkgJson = resolveFrom('@expo/cli/package.json');
  if (!pkgJson) {
    console.log('[patch-prebuild] @expo/cli not resolvable.');
    return;
  }
  const cliRoot = path.dirname(pkgJson);
  const prebuildFile = path.join(cliRoot, 'build', 'src', 'prebuild', 'prebuildAsync.js');
  if (!fs.existsSync(prebuildFile)) {
    console.log('[patch-prebuild] prebuildAsync.js missing.');
    return;
  }
  let content = fs.readFileSync(prebuildFile, 'utf8');
  if (content.includes('/* CI_PATCHED */')) {
    console.log('[patch-prebuild] already patched.');
    return;
  }
  const original = 'if (await (0, _prompts.confirmAsync)({';
  const patched  = 'if (/* CI_PATCHED */ false && await (0, _prompts.confirmAsync)({';
  if (!content.includes(original)) {
    console.log('[patch-prebuild] confirmAsync pattern not found.');
    return;
  }
  content = content.replace(original, patched);
  fs.writeFileSync(prebuildFile, content, 'utf8');
  console.log('[patch-prebuild] ✅ Patched', prebuildFile);
}

try { restoreBin();         } catch (e) { console.log('restoreBin error:', e.message); }
try { patchExpoBinCli();    } catch (e) { console.log('patchExpoBinCli error:', e.message); }
try { patchPrebuildAsync(); } catch (e) { console.log('patchPrebuildAsync error:', e.message); }
