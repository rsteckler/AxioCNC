module.exports = (api) => {
  const { env } = { ...api };
  const plugins = [
    'lodash',
  ];

  if (typeof env === 'function' && env('test')) {
    // Enable async/await for tests
    plugins.push('@babel/plugin-transform-runtime');
  }

  const baseConfig = {
    extends: '@trendmicro/babel-config',
    presets: [
      ['@babel/preset-env', {
        modules: 'cjs', // Explicitly output CommonJS for Node.js compatibility
      }],
      '@babel/preset-react'
    ],
    plugins,
    overrides: [
      // Server code must use CommonJS for Node.js compatibility (especially for lodash sub-path imports)
      {
        test: (filename) => {
          if (!filename) return false;
          return filename.includes('src/server') ||
                 filename.includes('src/server-cli.js') ||
                 filename.includes('src/shared') ||
                 filename.includes('/server/') ||
                 filename.includes('/shared/');
        },
        presets: [
          ['@babel/preset-env', {
            modules: 'cjs', // Force CommonJS for server code
          }],
        ],
      },
    ],
  };

  // Only add React Fast Refresh for non-server code in development
  if (typeof env === 'function' && env('development')) {
    // Use overrides to apply React Fast Refresh only to non-server files
    baseConfig.overrides.push({
      test: (filename) => {
        if (!filename) return false;
        // Only apply to files that are NOT server code
        return !filename.includes('src/server') &&
               !filename.includes('output/axiocnc/server') &&
               !filename.includes('dist/axiocnc/server');
      },
      plugins: ['react-refresh/babel'],
    });
  }

  return baseConfig;
};
