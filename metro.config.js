const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const metroConfig = withNativeWind(config, { input: './global.css' });
const rewriteRequestUrl = metroConfig.server.rewriteRequestUrl;

metroConfig.server.rewriteRequestUrl = (requestUrl) => {
  const rewritten = rewriteRequestUrl ? rewriteRequestUrl(requestUrl) : requestUrl;
  const url = new URL(rewritten, 'http://metro.local');
  let changed = false;

  // Native development clients can escape Expo's already-encoded asset
  // directory again. Decode only those separators, not filenames or other URLs.
  if (url.pathname === '/assets' || url.pathname === '/assets/') {
    const assetPath = url.searchParams.get('unstable_path');
    if (assetPath && /^\.%2f/i.test(assetPath)) {
      url.searchParams.set('unstable_path', assetPath.replace(/%2f/gi, '/'));
      changed = true;
    }
  } else if (/^\/assets\/\.%252f/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/%252f/gi, '/');
    changed = true;
  }

  if (!changed) return rewritten;
  return rewritten.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.href;
};

module.exports = metroConfig;
