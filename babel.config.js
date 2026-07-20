module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource: 'nativewind' enables className on core RN components.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Note: babel-preset-expo (SDK 54) auto-adds react-native-worklets/plugin
    // for Reanimated 4 — do not add it here or it will be applied twice.
  };
};
