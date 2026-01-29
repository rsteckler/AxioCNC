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
      // Server, shared, and desktop code must use CommonJS for Node.js compatibility
      {
        test: (filename) => {
          if (!filename) return false;
          return filename.includes('apps/server/') ||
                 filename.includes('apps/shared/') ||
                 filename.includes('apps/desktop/') ||
                 filename.includes('/server/') ||
                 filename.includes('/shared/') ||
                 filename.includes('/desktop/');
        },
        presets: [
          ['@babel/preset-env', {
            modules: 'cjs', // Force CommonJS for server and shared code
          }],
        ],
      },
    ],
  };

  // Only add React Fast Refresh for non-server code in development
  if (typeof env === 'function' && env('development')) {
    // Use overrides to apply React Fast Refresh only to web sources
    baseConfig.overrides.push({
      test: (filename) => {
        if (!filename) return false;
        return /apps[\\/]+web[\\/]+/.test(filename);
      },
      plugins: ['react-refresh/babel'],
    });
  }

  return baseConfig;
};
