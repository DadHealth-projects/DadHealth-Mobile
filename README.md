# Dad Health Mobile

React Native (Expo SDK 54) app for Dad Health — shares the same Supabase backend
as the web app (`../dadHealth`).

## Setup

This app reads its Supabase keys from environment variables only (no keys are
committed). Create a `.env` in this folder with the keys from the web project:

```bash
# from dadhealth-mobile/ — the web project keeps its keys in .env
grep SUPABASE ../dadHealth/.env > .env
```

Or copy the template and fill it in manually:

```bash
cp .env.example .env
```

`.env` must define:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
```

The app throws on startup if either is missing. `EXPO_PUBLIC_WEB_URL` is optional
(defaults to `https://dadhealth.co.uk`).

> `EXPO_PUBLIC_`-prefixed vars are inlined into the JS bundle at build time. The
> Supabase anon key is a public client key, so this is expected — but keys still
> live in `.env` (git-ignored), never hardcoded in source.

## Run

```bash
npx expo start --clear   # then press i for iOS, or scan the QR in Expo Go
```

## Docs

See `claude.md` for architecture (navigation, theme/NativeWind, auth/biometric)
and known gotchas.
