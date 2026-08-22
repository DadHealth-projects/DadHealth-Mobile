import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const oauthSource = readFileSync(new URL('../lib/oauth.ts', import.meta.url), 'utf8');
const loginSource = readFileSync(
  new URL('../screens/subscreens/LoginScreen.tsx', import.meta.url),
  'utf8',
);

function loadOauth({ apple, auth }) {
  const compiled = ts.transpileModule(oauthSource, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'oauth.ts',
  }).outputText;

  const module = { exports: {} };
  const context = vm.createContext({
    URL,
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'react-native') return { Platform: { OS: 'ios' } };
      if (specifier === 'expo-web-browser') {
        return {
          maybeCompleteAuthSession() {},
          async openAuthSessionAsync() {
            return { type: 'cancel' };
          },
        };
      }
      if (specifier === 'expo-auth-session') {
        return { makeRedirectUri: () => 'dadhealth://auth/callback' };
      }
      if (specifier === 'expo-apple-authentication') return apple;
      if (specifier === './supabase') return { supabase: { auth } };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });

  const script = new vm.Script(`(function (exports, require, module) { ${compiled}\n})`);
  script.runInContext(context)(module.exports, context.require, module);
  return module.exports;
}

function appleModule(signInAsync) {
  return {
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    isAvailableAsync: async () => true,
    signInAsync,
  };
}

function session(accessToken = 'new-access-token', userId = 'user-1') {
  return {
    access_token: accessToken,
    user: { id: userId, last_sign_in_at: '2026-08-22T12:00:00.000Z' },
  };
}

test('Apple Sign In returns success when the ID-token exchange returns a session', async () => {
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithIdToken: async () => ({ data: { session: session() }, error: null }),
  };
  const oauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth,
  });

  const result = await oauth.signInWithApple();
  assert.equal(result.error, null);
});

test('Apple Sign In reports cancellation with approved production copy', async () => {
  const oauth = loadOauth({
    apple: appleModule(async () => {
      throw { code: 'ERR_REQUEST_CANCELED' };
    }),
    auth: {},
  });

  const result = await oauth.signInWithApple();
  assert.equal(result.error, 'Apple Sign In was cancelled.');
});

test('Apple Sign In reports a genuine rejected exchange without exposing its raw error', async () => {
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithIdToken: async () => ({
      data: { session: null, user: null },
      error: { message: 'provider rejected internal detail' },
    }),
  };
  const oauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth,
  });

  const result = await oauth.signInWithApple();
  assert.equal(result.error, "We couldn't complete Apple Sign In. Please try again.");
  assert.doesNotMatch(result.error, /provider|internal detail/i);
});

test('Apple Sign In treats a throw after a valid new session as success', async () => {
  let sessionRead = 0;
  const auth = {
    getSession: async () => {
      sessionRead += 1;
      return {
        data: { session: sessionRead === 1 ? null : session() },
        error: null,
      };
    },
    getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
    signInWithIdToken: async () => {
      throw new Error('post-auth subscriber failed');
    },
  };
  const oauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth,
  });

  const result = await oauth.signInWithApple();
  assert.equal(result.error, null);
});

test('Apple Sign In does not mistake an existing session token refresh for this Apple attempt', async () => {
  let sessionRead = 0;
  const previous = session('previous-access-token');
  const refreshed = session('refreshed-access-token');
  const auth = {
    getSession: async () => {
      sessionRead += 1;
      return { data: { session: sessionRead === 1 ? previous : refreshed }, error: null };
    },
    signInWithIdToken: async () => {
      throw new Error('exchange failed');
    },
  };
  const oauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth,
  });

  const result = await oauth.signInWithApple();
  assert.equal(result.error, "We couldn't complete Apple Sign In. Please try again.");
});

test('Apple Sign In maps network and incomplete-session failures to approved copy', async () => {
  const connectionOauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithIdToken: async () => {
        throw new TypeError('Network request failed');
      },
    },
  });
  assert.equal(
    (await connectionOauth.signInWithApple()).error,
    "We couldn't complete Apple Sign In because of a connection problem. Check your connection and try again.",
  );

  let sessionRead = 0;
  const incompleteOauth = loadOauth({
    apple: appleModule(async () => ({ identityToken: 'apple-id-token' })),
    auth: {
      getSession: async () => {
        sessionRead += 1;
        return {
          data: { session: sessionRead === 1 ? null : session() },
          error: null,
        };
      },
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid session' } }),
      signInWithIdToken: async () => {
        throw new Error('post-auth completion failed');
      },
    },
  });
  assert.equal(
    (await incompleteOauth.signInWithApple()).error,
    "Apple Sign In succeeded, but we couldn't finish signing you in. Please try again.",
  );
});

test('the Login screen renders the production-safe error returned by the Apple helper', () => {
  assert.match(loginSource, /if \(error\) \{\s*setError\(error\);/);
  assert.doesNotMatch(
    loginSource,
    /setError\('Apple sign-in could not be completed\. Please try again\.'\)/,
  );
});
