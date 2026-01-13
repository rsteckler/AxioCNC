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
      '@babel/preset-env',
      '@babel/preset-react'
    ],
    plugins,
  };

  // Only add React Fast Refresh for non-server code in development
  if (typeof env === 'function' && env('development')) {
    // Use overrides to apply React Fast Refresh only to non-server files
    baseConfig.overrides = [
      {
        test: (filename) => {
          if (!filename) return false;
          // Only apply to files that are NOT server code
          return !filename.includes('src/server') &&
                 !filename.includes('output/axiocnc/server') &&
                 !filename.includes('dist/axiocnc/server');
        },
        plugins: ['react-refresh/babel'],
      }
    ];
  }

  return baseConfig;
};
