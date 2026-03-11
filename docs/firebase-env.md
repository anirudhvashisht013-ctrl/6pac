# Firebase Runtime Config (Expo + EAS)

## Single source of truth

Firebase values flow through one path:

1. Environment variables (`EXPO_PUBLIC_FIREBASE_*`)
2. `app.config.ts` -> `expo.extra.firebase`
3. Runtime loader (`lib/config/runtimeConfig.ts`)
4. Firebase bootstrap (`lib/firebase.ts`)

The app must not read Firebase config directly from `process.env` at runtime.

## Required environment keys

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

Optional:

- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`

## Local development

- Put real development values in `.env`.
- Run: `npm run validate:firebase-config`

## Production / EAS

- Put production values in EAS Environment Variables for the selected environment/profile.
- `eas.json` maps profile -> environment (`development`, `preview`, `production`).
- Optional local file for production checks: `.env.production` (gitignored).
- Copy from `.env.production.example` when needed.
- Run before building: `npm run validate:firebase-config:prod`

## Build workflow

Recommended Android build command:

```sh
npm run eas:build:android
```

This runs validation first, then starts EAS build.

Validation chain:

- `npm run validate:lockfile-sync`
- `npm run validate:firebase-config:prod`

This prevents both common pre-build failures:

- EAS `npm ci` failing because `package.json` and `package-lock.json` are out of sync.
- Firebase env values being missing/placeholder at release build time.
