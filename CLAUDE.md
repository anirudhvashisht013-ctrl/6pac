# CLAUDE.md — 6PAC

6PAC is a React Native / Expo fitness tracker on Firebase (Auth + Firestore).
All user data lives under `users/{uid}/` in Firestore, mirrored from a local-first
AsyncStorage cache via `lib/repos/cloudMirrorRepo.ts`.

## 🔴 Standing workflow rules (read these first, every session)

1. **At the start of each session, read `IMPLEMENTATION_STATUS.md`.** It is the
   running log of what has been built, changed, or removed. Treat it as the source
   of project context so the user does not have to re-explain.

2. **On every feature push (and before any `git commit` / `git push`), update
   `IMPLEMENTATION_STATUS.md`** with a brief entry of what changed / was added /
   was updated / was removed. Keep it short — a dated section or bullet list, files
   touched, and status (done / partial / verification). The most recent pass goes
   near the top of that file under its own dated heading.

3. Keep changes minimal and scoped; match the existing design system
   (cyan `#00E5FF` accent, dark surfaces, Outfit font). Don't refactor wholesale.

## Verify before shipping
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit`
- Unit tests: `npm run test:unit` (`node --import tsx --test "lib/**/*.test.ts"`)
- `npm install` errors with `EROFS` in this environment, but `node_modules` is
  already present and the toolchain works — no install needed.

## Non-obvious structure (so you don't go looking in the wrong place)
- The "plan all 7 days to unlock workouts" gate is enforced in
  `app/(tabs)/workouts.tsx` (start buttons), NOT `app/(tabs)/week.tsx` (banner only).
- `lib/reminders/engine.ts` has its OWN separate `isWeekReady` for reminder
  scheduling — independent of the workout-start gate.
- Today screen quick-log pills (`app/(tabs)/index.tsx`) are
  Calories / Sleep / Steps / Water / Weight — there is NO Supplements pill.
- `caloriesManual` on `daily_logs` is legacy: only `lib/seed.ts` writes it.
  Real calories come from `nutrition_entries` (meals).
- Profile/account truth: Firestore `users/{uid}` via `lib/userProfile.ts` +
  `lib/adapters/accountProfileAdapter.ts`; onboarding writes through
  `AuthContext.updateUser` → `markOnboardingDone`.

## Out of scope unless asked (v2)
BMR/TDEE/macro calculations, the Lose/Maintain/Gain toggle logic, the onboarding
goal selector logic, a calculated "Off target" nutrition badge, trend charts, food
databases. Leave these inert.
