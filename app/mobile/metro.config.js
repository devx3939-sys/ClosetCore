const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files in the sibling shared folder.
const sharedRoot = path.resolve(__dirname, '..', 'shared');
config.watchFolders = [sharedRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.extraNodeModules = {
  '@shared': sharedRoot,
};

module.exports = config;
