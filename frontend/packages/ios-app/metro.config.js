const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable web support
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add support for workspace packages
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Configure platform-specific extensions for better resolution
config.resolver.sourceExts = [...config.resolver.sourceExts, 'web.ts', 'web.tsx'];

// Resolve platform-specific files
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// For all builds, exclude Node.js specific modules and @manuel/shared
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  // Map Node.js modules to browser equivalents or empty modules
  'fs/promises': require.resolve('./src/utils/empty-module.js'),
  'fs': require.resolve('./src/utils/empty-module.js'),
  'path': require.resolve('path-browserify'),
  'os': require.resolve('os-browserify/browser'),
  'crypto': require.resolve('crypto-browserify'),
  // Block @manuel/shared for iOS builds to avoid Node.js dependencies
  '@manuel/shared': require.resolve('./src/utils/empty-module.js'),
};

// Block resolution of problematic modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block @manuel/shared imports on all platforms to avoid Node.js dependencies
  if (moduleName.startsWith('@manuel/shared')) {
    return {
      filePath: require.resolve('./src/utils/empty-module.js'),
      type: 'sourceFile',
    };
  }
  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
