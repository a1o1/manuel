const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config before returning it
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "fs": false,
    "fs/promises": false,
    "path": require.resolve("path-browserify"),
    "os": require.resolve("os-browserify/browser"),
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "util": require.resolve("util/"),
  };

  // Add aliases to prevent importing Node.js specific code
  config.resolve.alias = {
    ...config.resolve.alias,
    // Redirect shared package imports to empty modules for web
    '@manuel/shared/dist/platform/storage/node': path.resolve(__dirname, 'src/utils/empty-module.js'),
    '@manuel/shared/dist/platform/audio/node': path.resolve(__dirname, 'src/utils/empty-module.js'),
    '@manuel/shared/dist/platform': path.resolve(__dirname, 'src/utils/empty-module.js'),
    // Don't completely disable shared, just the platform-specific parts
    '@manuel/shared': path.resolve(__dirname, '../shared/dist/index.js'),
  };

  // Add a rule to handle the shared package more carefully
  config.module.rules.push({
    test: /\/shared\/.*\/(node|electron)\.js$/,
    use: 'null-loader',
  });

  return config;
};
