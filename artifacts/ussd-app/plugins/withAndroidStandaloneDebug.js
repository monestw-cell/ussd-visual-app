const {
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SPLITS_AND_RENAME_BLOCK = `
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }

    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            output.outputFileName = "app-\${variant.buildType.name}.apk"
        }
    }
`;

module.exports = function withAndroidStandaloneDebug(config) {
  config = withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('android {') && !g.includes('splits {')) {
      g = g.replace(/android\s*\{/, 'android {' + SPLITS_AND_RENAME_BLOCK);
    }
    cfg.modResults.contents = g;
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    let mainApp = cfg.modResults.contents;
    if (!mainApp.includes('getUseDeveloperSupport')) {
      mainApp = mainApp.replace(
        /(override\s+val\s+isNewArchEnabled[^\n]+)/,
        '$1\n\n          override fun getUseDeveloperSupport(): Boolean = false'
      );
    }
    cfg.modResults.contents = mainApp;
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const assetsDir = path.join(platformRoot, 'app', 'src', 'main', 'assets');
      const resDir = path.join(platformRoot, 'app', 'src', 'main', 'res');
      const bundlePath = path.join(assetsDir, 'index.android.bundle');

      fs.mkdirSync(assetsDir, { recursive: true });

      console.log('[STANDALONE] Pre-bundling JS...');
      try {
        execSync(
          `npx expo export:embed --platform android --dev false --bundle-output "${bundlePath}" --assets-dest "${resDir}"`,
          { cwd: projectRoot, stdio: 'inherit' }
        );
        const stats = fs.statSync(bundlePath);
        console.log(`[STANDALONE] Bundle: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (e) {
        console.error('[STANDALONE] Bundle FAILED:', e.message);
        throw e;
      }

      return cfg;
    },
  ]);

  return config;
};
