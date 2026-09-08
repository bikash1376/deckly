const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

// Hunspell dictionary files ship as assets. `dictionary-en` loads them through
// Node's fs, which does not exist in React Native, so the .aff and .dic are
// copied into assets/ and read at runtime instead.
config.resolver.assetExts.push("aff", "dic");

// withUniwindConfig must wrap every other Metro config wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
