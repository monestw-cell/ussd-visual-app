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

module.exports = function withAndroidStandaloneDebug(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;

    if (g.includes('react {') && !g.includes('bundleInDebug')) {
      g = g.replace(/react\s*\{/, 'react {\n    bundleInDebug = true');
    }

    if (g.includes('android {') && !g.includes('splits {')) {
      g = g.replace(/android\s*\{/, 'android {' + ABI_SPLITS_BLOCK);
    }

    cfg.modResults.contents = g;
    return cfg;
  });
};
