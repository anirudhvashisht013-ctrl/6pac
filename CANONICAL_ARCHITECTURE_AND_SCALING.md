# Canonical Architecture And Scaling Guide

**Status**: current implemented architecture after the safe migration slices  
**Scope**: logical boundaries, current physical storage, scaling direction, and remaining work

## 1. What Is Implemented Now

The app now has a clearer logical architecture without changing the physical storage layout yet.

### A. Canonical local-first business domains

These are still stored locally first in AsyncStorage and mirrored to Firestore:

- `DailyCheckIn`
  - Repo: `dailyCheckInRepo` alias to `logsRepo`
  - Storage: `@6pac:logs:${uid}`
  - Mirror: `users/{uid}/daily_logs/{date}`
- `NutritionEntry`
  - Repo: `nutritionEntryRepo` alias to `mealsRepo`
  - Storage: `@6pac:meals:${uid}`
  - Mirror: `users/{uid}/nutrition_entries/{id}`
- `WeeklyTarget`
  - Repo: `weeklyTargetRepo` alias to `targetsRepo`
  - Storage: `@6pac:targets:${uid}`
  - Mirror: `users/{uid}/weekly_targets/{weekStartDate}`
- `WeeklyPlan`
  - Repo: `weeklyPlanRepo`
  - Compatibility alias: `schedulesRepo`
  - Storage: `@6pac:schedules:${uid}`
  - Mirror: `users/{uid}/weekly_plans/{weekStartDate}`
- `WorkoutTemplate`
  - Repo: `workoutTemplateRepo` alias to `workoutsRepo`
  - Storage: `@6pac:templates:${uid}`
  - Mirror: `users/{uid}/workout_templates/{id}`
- `ExerciseLibraryItem`
  - Repo: `exerciseLibraryRepo` alias to `exercisesRepo`
  - Storage: `@6pac:exercises:${uid}`
  - Mirror: `users/{uid}/exercises/{id}`
- `WorkoutSession`
  - Repo: `workoutSessionRepo` and `workoutExecutionRepo` aliases to `sessionsRepo`
  - Storage: `@6pac:sessions:${uid}`
  - Mirror: `users/{uid}/workout_sessions/{id}`
- `BodyMeasurementEntry`
  - Repo: `bodyMeasurementRepo` alias to `measurementsRepo`
  - Storage: `@6pac:measurements:${uid}`
  - Mirror: `users/{uid}/body_measurements/{dateOrLegacyId}`

### B. Firestore-direct domains

These are still canonical in Firestore:

- `AccountProfile`
  - Repo: `accountProfileRepo`
  - Physical doc: `users/{uid}`
- `PublicIdentityClaim`
  - Service boundary: `publicIdentityClaimService`
  - Physical doc: `friend_refs_v1/{friendRefId}`
- Friend workflow and social docs
  - `friend_requests_v1`
  - `friendships_v1`
  - `shared_workouts_v1`
  - `shared_workout_copies_v1`

### C. Adapter boundaries that are now implemented

- `MeasurementKeyAdapter`
  - Canonical logical key is `date`
  - Legacy `id` fallback still supported
- `WeeklyPlanAdapter`
  - Converts persisted `WeekSchedule` shape into logical `WeeklyPlan`
  - Owns `DayAssignment[]` invariants
- `WorkoutSessionSnapshotAdapter`
  - Treats `WorkoutSession` as execution truth
  - Preserves `workoutNameSnapshot`, `sessionBlocks`, `blockPerformances`
- `ReminderStateAdapter`
  - Splits logical ownership into `ReminderSettings` and `ReminderRuntime`
- `AccountProfileAdapter`
  - Splits `users/{uid}` into `core`, `bridge`, and `projection` semantics
- `PublicIdentityClaimAdapter`
  - Clarifies public discoverability ownership in `friend_refs_v1`

### D. Projection and infrastructure boundaries now implemented

- `daily_summaries`
  - Explicitly reclassified as a derived materialized projection only
  - Projection builder: `lib/projections/dailySummaryProjection.ts`
- Sync infrastructure remains explicit
  - mirror queue
  - reconcile checkpoints
  - sync tombstones
  - local snapshot aggregate

## 2. Current Physical Structure

### AsyncStorage

- `@6pac:logs:${uid}`
- `@6pac:meals:${uid}`
- `@6pac:targets:${uid}`
- `@6pac:schedules:${uid}`
- `@6pac:templates:${uid}`
- `@6pac:exercises:${uid}`
- `@6pac:sessions:${uid}`
- `@6pac:measurements:${uid}`
- `@6pac:reminders:${uid}`
- `@6pac:mirror_queue_v1`
- `@6pac:reconcile_checkpoint_v1:${uid}`
- `@6pac:friends_dashboard_v1:${uid}`
- legacy local auth/cache keys still exist

### Firestore

#### Physical bootstrap/profile root

- `users/{uid}`

#### Mirrored local-first subcollections

- `users/{uid}/daily_logs/{date}`
- `users/{uid}/nutrition_entries/{id}`
- `users/{uid}/weekly_targets/{weekStartDate}`
- `users/{uid}/weekly_plans/{weekStartDate}`
- `users/{uid}/workout_templates/{id}`
- `users/{uid}/exercises/{id}`
- `users/{uid}/workout_sessions/{id}`
- `users/{uid}/body_measurements/{dateOrLegacyId}`
- `users/{uid}/reminder_settings/primary`
- `users/{uid}/daily_summaries/{date}`
- `users/{uid}/sync_tombstones/{encodedKey}`

#### Firestore-direct social collections

- `friend_refs_v1/{friendRefId}`
- `friend_requests_v1/{pairKey}`
- `friendships_v1/{pairKey}`
- `shared_workouts_v1/{ownerUid}__{templateId}`
- `shared_workout_copies_v1/{ownerUid}__{copierUid}__{sourceTemplateId}`

## 3. Canonical Logical Structure

This is the target business architecture already introduced logically in code.

### A. Canonical entities

- `AccountProfile`
  - Owns onboarding/account/private profile semantics
  - Does not truly own public identity or derived streaks long-term
- `DailyCheckIn`
  - One record per `date`
- `NutritionEntry`
  - One meal/event row per `id`
- `WeeklyTarget`
  - One record per `weekStartDate`
- `WeeklyPlan`
  - One planner record per `weekStartDate`
- `ExerciseLibraryItem`
  - One exercise definition per `id`
- `WorkoutTemplate`
  - Reusable authored workout definition
- `WorkoutSession`
  - Execution truth for started/completed/missed workouts
- `BodyMeasurementEntry`
  - One measurement record per canonical logical `date`
- `ReminderSettings`
  - Durable syncable reminder preferences
- `PublicIdentityClaim`
  - Public discoverability handle
- `FriendRequest`
  - Pending social request workflow
- `Friendship`
  - Accepted friend edge

### B. Assignment and snapshot boundaries

- `DayAssignment`
  - Embedded inside `WeeklyPlan`
  - Planner-only state
- `WorkoutSessionSnapshot`
  - Embedded inside `WorkoutSession`
  - Historical execution snapshot
- `SharedWorkoutPublication`
  - Published workout projection for sharing
- `SharedWorkoutCopyLineage`
  - Copy audit and dedupe lineage
- Request-side user snapshots
  - Embedded into friend request docs

### C. Derived and projection boundaries

- `DailySummary`
  - Rebuildable materialized summary only
- `ProfileStatsProjection`
  - Streaks and similar derived values
- `ReminderPlanProjection`
  - Pending reminders built from source entities
- `FriendsDashboardCache`
  - Local cache only
- `CloudMirrorProjection<T>`
  - Firestore mirror copy of local-first entities

### D. Infrastructure boundaries

- `MirrorQueueItem`
- `SyncTombstone`
- `ReconcileCheckpoint`
- `LocalDataSnapshot`
- `ReminderRuntime`

## 4. Key Ownership Rules

These are the most important rules future work should keep.

### Planner vs execution

- `WeeklyPlan` owns planner intent only
- `WorkoutSession` owns execution truth
- completed or missed state must stay in `WorkoutSession`
- planner status must not become execution truth

### Template vs snapshot

- `WorkoutTemplate` is reusable authoring data
- `WorkoutSession` must preserve execution snapshot fields
- shared workouts must preserve publication snapshots
- exercise-linked template blocks must keep fallback snapshot fields where needed

### Canonical vs derived

- `daily_summaries` is derived only
- streak fields are projections, not core profile truth
- nutrition totals remain derived from meals plus manual daily adjustment

### Profile vs public identity

- `AccountProfile` is private/bootstrap/account boundary
- `PublicIdentityClaim` is discoverability boundary
- `friendRefId` on `users/{uid}` is a bridge field in v1, not the real public identity root

## 5. How Future Scaling Should Work

The current architecture is intentionally conservative. Scaling should build on the logical boundaries already added instead of forcing a risky storage rewrite.

### A. Scaling users and devices

- keep local-first repos as the primary write path for fitness data
- keep Firestore mirrors as recovery and multi-device sync projections
- tighten per-entity reconcile rules, not broad global merge rules
- add schema versions at the adapter boundary before any large physical migration

### B. Scaling planning and workouts

- keep `WeeklyPlan` aggregated for v1 and near-term growth
- only split into persisted day docs if real conflict or collaboration requirements appear
- keep `WorkoutSessionSnapshot` embedded for historical stability
- if planning needs stronger freeze semantics later, add a first-class assignment snapshot after the current boundaries are stable

### C. Scaling exercise and template evolution

- keep `WorkoutTemplate` partially denormalized on purpose
- preserve `exerciseName` and reference snapshots in template blocks
- allow the exercise library to evolve without breaking historical plans or shared copies

### D. Scaling social features

- keep social boundaries separate
  - claim
  - request
  - friendship
  - publication
  - copy lineage
- if social discovery grows, index and query through `PublicIdentityClaim`, not through `users/{uid}`

### E. Scaling reminders

- keep `ReminderSettings` syncable
- keep `ReminderRuntime` local-first until cross-device reminder state is truly needed
- if a runtime field becomes cross-device important, promote only that field intentionally

### F. Scaling analytics and summaries

- keep `daily_summaries` as a materialized projection
- rebuild it from canonical entities when needed
- do not move business ownership into the summary document

## 6. What Is Still Left To Be Done

### Important before broader architecture changes

- complete full manual QA across:
  - Today
  - Nutrition
  - Week planning
  - Workouts
  - Measurements
  - Reminders
  - Friends
  - Auth/profile flows
- verify old data still behaves correctly for:
  - legacy measurement `id`
  - partial profile docs
  - old workout sessions with repaired snapshots
  - public identity bridge fallback

### Safe cleanup that can happen later

- replace old repo imports with target-facing aliases gradually
- reduce direct `getUserProfile()` usage in screens
- remove `usersRepo` legacy local cache once no screen depends on it
- reduce old repo naming dominance:
  - `workoutsRepo`
  - `schedulesRepo`
  - `sessionsRepo`
- remove legacy alias collection dual-read only after backfill is complete
- physically split reminder local storage only after the logical split has proven stable

### Larger migrations that should wait

- renaming Firestore collections
- renaming AsyncStorage keys
- splitting `users/{uid}` physically
- splitting `WeeklyPlan` into day documents
- splitting `WorkoutSession` into multiple persisted entities
- removing bridge fields like `friendRefId` from `users/{uid}` before all callers are migrated

## 7. Canonical Structure To Aim For

This is the simplest long-term target that matches what is already implemented logically.

### Canonical roots

- `AccountProfile`
- `DailyCheckIn`
- `NutritionEntry`
- `WeeklyTarget`
- `WeeklyPlan`
- `ExerciseLibraryItem`
- `WorkoutTemplate`
- `WorkoutSession`
- `BodyMeasurementEntry`
- `ReminderSettings`
- `PublicIdentityClaim`
- `FriendRequest`
- `Friendship`

### Embedded children or snapshots

- `WeeklyPlan.days[]` as `DayAssignment[]`
- `WorkoutSession.sessionBlocks`
- `WorkoutSession.blockPerformances`
- `WorkoutSession.workoutNameSnapshot`
- shared workout embedded template snapshot
- friend request embedded user snapshots

### Projection-only layers

- `DailySummary`
- profile streak projections
- reminder planning projections
- friends dashboard cache
- cloud mirror documents for local-first entities

## 8. Recommended Stop Line For v1

The architecture is already in a good v1 state if manual QA is clean.

### Good enough now

- logical boundaries are present
- high-risk identity and snapshot rules are clarified
- measurement keys are centralized
- planning and execution are separated logically
- reminders are split logically
- `daily_summaries` is isolated as a projection

### Do not touch yet

- do not rename collections
- do not rename AsyncStorage keys
- do not do a large physical schema migration
- do not remove legacy compatibility paths yet
- do not over-refactor screens only for naming cleanup

## 9. File Landmarks

Use these files as the main architecture reference points:

- `lib/storage.ts`
- `lib/userProfile.ts`
- `lib/friends/service.ts`
- `lib/adapters/weeklyPlanAdapter.ts`
- `lib/adapters/measurementKeyAdapter.ts`
- `lib/adapters/workoutSessionSnapshotAdapter.ts`
- `lib/adapters/reminderStateAdapter.ts`
- `lib/adapters/accountProfileAdapter.ts`
- `lib/adapters/publicIdentityClaimAdapter.ts`
- `lib/projections/dailySummaryProjection.ts`

This is the architecture to extend from. Future changes should prefer adding or tightening boundaries here before attempting physical schema changes.
