const path = require('path');

const bundleDir = process.env.AXIOCNC_BUNDLE_DIR;
const outputDir = process.env.AXIOCNC_OUTPUT_DIR;
if (!bundleDir) {
  throw new Error('AXIOCNC_BUNDLE_DIR is required for desktop packaging');
}
if (!outputDir) {
  throw new Error('AXIOCNC_OUTPUT_DIR is required for desktop packaging');
}

module.exports = {
  appId: 'org.axiocnc',
  productName: 'AxioCNC',
  extraMetadata: {
    name: 'axiocnc',
  },
  directories: {
    buildResources: 'build-resources',
    output: outputDir,
  },
  extraResources: [
    {
      from: path.join(bundleDir, 'app'),
      to: 'axiocnc/app',
    },
    {
      from: path.join(bundleDir, 'server'),
      to: 'axiocnc/server',
    },
    {
      from: path.join(bundleDir, 'shared'),
      to: 'axiocnc/shared',
    },
    {
      from: path.join(bundleDir, 'node_modules'),
      to: 'axiocnc/node_modules',
    },
    {
      from: path.join(bundleDir, 'package.json'),
      to: 'axiocnc/package.json',
    },
  ],
  files: [
    'dist/**/*',
    'package.json',
  ],
  asar: true,
  publish: [],
  artifactName: 'axiocnc-desktop_${version}_${arch}.${ext}',
  mac: {
    category: 'public.app-category.productivity',
    target: [
      'dmg',
    ],
    icon: 'build-resources/icon.icns',
  },
  dmg: {
    background: 'build-resources/background.png',
    icon: 'build-resources/icon.icns',
    iconSize: 80,
    iconTextSize: 12,
    contents: [
      {
        x: 448,
        y: 344,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 192,
        y: 344,
        type: 'file',
      },
    ],
  },
  win: {
    target: [
      'nsis',
    ],
    icon: 'build-resources/icon.ico',
  },
  linux: {
    category: 'Utility',
    target: [
      'deb',
    ],
  },
};
