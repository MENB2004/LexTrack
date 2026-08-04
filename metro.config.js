const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Direct Metro cache to local project folder instead of C:\Users\judin\.expo
const FileStore = require('metro-cache').FileStore;
config.cacheStores = [
  new FileStore({
    root: path.join(__dirname, '.expo', 'metro-cache'),
  }),
];

module.exports = config;
