# 6Pac - Fitness Tracking App

## Overview
6Pac is a structured fitness system mobile app built with Expo React Native. All data is stored locally using AsyncStorage (no server dependency).

## Architecture

### Tech Stack
- **Frontend**: Expo Router (file-based routing), React Native
- **Styling**: StyleSheet + custom dark theme
- **Fonts**: Outfit (Google Fonts via @expo-google-fonts/outfit)
- **Storage**: AsyncStorage (all data local, no server needed)
- **State**: React Context (AuthContext) + React Query (for future server state)
- **Icons**: @expo/vector-icons (Ionicons, MaterialCommunityIcons)

### Key Features
1. **Local Auth**: Email + password with SHA256 hashing via expo-crypto. Session persisted in AsyncStorage.
2. **Onboarding**: Multi-step profile setup on first login (name, DOB, sex, weight, goal).
3. **Today Tab**: Daily metric logging (weight, sleep, water, steps, supplements, notes).
4. **Week Tab**: Weekly planner with targets (calories/steps/water), C/S/W indicators, star system.
5. **Workouts Tab**: Template builder + workout player (gym/cardio/rest blocks with timers).
6. **Nutrition Tab**: Meal logging with calories and macros (P/C/F).
7. **Progress Tab**: Weight trend chart, adherence analytics, body measurements.
8. **Body Measurements**: Twice-monthly tracking with history.

### Storage Layer (AsyncStorage)
All data namespaced: `@6pac:{type}:{userId}`
- `users` - User accounts
- `session_token` / `current_user_id` - Session
- `logs:{uid}` - Daily logs
- `targets:{uid}` - Weekly targets
- `schedules:{uid}` - Week schedules
- `templates:{uid}` - Workout templates
- `meals:{uid}` - Meal entries
- `sessions:{uid}` - Workout sessions
- `measurements:{uid}` - Body measurements

### File Structure
```
app/
  _layout.tsx          # Root layout + auth guard
  (auth)/              # Auth screens (login, signup, onboarding)
  (tabs)/              # Main 5-tab navigation
    index.tsx          # Today
    week.tsx           # Week planner
    workouts.tsx       # Workout templates
    nutrition.tsx      # Meal logging
    progress.tsx       # Analytics
  player.tsx           # Workout player (full screen)
  editor.tsx           # Workout template editor
  measurements.tsx     # Body measurements

lib/
  types.ts             # TypeScript interfaces
  storage.ts           # AsyncStorage repositories
  auth.ts              # Auth utilities (hash, login, signup)
  dates.ts             # Date utility functions
  seed.ts              # Seed data for new users

context/
  AuthContext.tsx      # Global auth state
```

## Business Rules
- **Week starts Monday**
- **Calories met**: within ±5% of daily target
- **Steps met**: >= daily target
- **Water met**: >= daily target
- **Star day**: All three (C + S + W) are met
- **Week READY**: All 7 days (Mon–Sun) have a status != "unplanned"
- **Workout gating**: Can only start workouts if week is READY
- **Future days**: Cannot edit logs for future dates
- **Seed data**: Auto-seeded on first login (3 templates, schedule, logs, meals, targets)

## Workflows
- `Start Frontend`: `npm run expo:dev` on port 8081
- `Start Backend`: `npm run server:dev` on port 5000 (minimal, for landing page only)

## Dependencies
Key packages: expo-crypto, @expo-google-fonts/outfit, react-native-svg, expo-haptics
