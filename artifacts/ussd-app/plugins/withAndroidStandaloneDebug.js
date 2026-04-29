const { withAppBuildGradle } = require('expo/config-plugins');

const ABI_SPLITS_BLOCK = `
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }
`;

const RELEASE_SIGNING_BLOCK = `
        release {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

module.exports = function withAndroidStandaloneDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;

    if (g.includes('android {') && !g.includes('splits {')) {
      g = g.replace(/android\s*\{/, 'android {' + ABI_SPLITS_BLOCK);
    }

    if (g.includes('signingConfigs {') && !g.match(/signingConfigs\s*\{[\s\S]*?release\s*\{/)) {
      g = g.replace(
        /signingConfigs\s*\{/,
        'signingConfigs {' + RELEASE_SIGNING_BLOCK
      );
    }

    g = g.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.)debug/,
      '$1release'
    );

    cfg.modResults.contents = g;
    return cfg;
  });
};
