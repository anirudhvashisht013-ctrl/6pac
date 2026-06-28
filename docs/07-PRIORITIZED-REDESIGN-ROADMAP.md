# 6Pac Prioritized Redesign Roadmap

## 1. Outcome

The roadmap turns 6Pac from a collection of capable trackers into one understandable loop:

> Plan the week → act today → log quickly → review progress → adjust the next week.

Do not begin with a visual reskin. Stabilize trust and the workout player, establish shared primitives, then restructure the daily loop.

## 2. North-star behavior

A retained user should be able to:

1. open Today;
2. understand the next action in under five seconds;
3. start a planned workout or log a meal/check-in in one tap;
4. complete common logging without horizontal scrolling or repeated typing;
5. trust that everything is saved locally;
6. recover when the week changes;
7. understand one useful progress insight at weekly review.

## 3. Phase 0 — Release and trust stabilization

These items block any credible UX evaluation.

### P0.1 Fix entry and build readiness

- Replace/re-authorize Firebase web configuration.
- Add production config validation to CI.
- Map Firebase errors to plain language.
- Resolve the two Today screen TypeScript errors.
- Keep lint at zero errors and reduce warnings.
- Add a source-integrity check that rejects NUL bytes.

**Done when**

- sign-up, login, reset password, logout, and restore work in production-like builds;
- `tsc --noEmit`, lint, build, and tests pass;
- no raw backend error is visible.

### P0.2 Fix workout-player layout

- Replace horizontal set table with responsive set rows.
- Remove delete from the primary horizontal row.
- Add target and previous performance.
- Test 320, 390, 430 px and 200% text.
- Test keyboard-open state.

**Done when**

- every set control is visible and operable;
- no horizontal scroll;
- completion state is announced;
- local save is immediate.

### P0.3 Correct privacy defaults

- Default every new workout/routine to Private.
- Migrate legacy `undefined` sharing state to Private.
- Show privacy state in editor and copied-workout flow.
- Audit Firestore rules and public identity data.

**Done when**

- no workout becomes visible without explicit opt-in;
- existing users see a migration explanation if behavior changes.

### P0.4 Make failures recoverable

- Friends: Back, Retry, cached state, support/details.
- Sync: remove overlay; use in-layout banner.
- Startup/not-found: shared branded ErrorState.
- Preserve route intent through auth/deep links.

**Done when**

- every full-screen failure has an exit and recovery action;
- no banner covers navigation or primary actions.

## 4. Phase 1 — Design-system foundation

Build only the primitives needed for the first redesigned flows.

### Tokens

- accessible semantic dark colors;
- type styles with line heights;
- spacing and radius;
- motion;
- unit/date formatting.

### Primitives

1. Text
2. Button
3. IconButton
4. Screen
5. AppHeader
6. Card
7. ListRow
8. FormField/NumericField
9. Sheet/Dialog
10. Banner/Empty/Error

### Quality gates

- label required for IconButton;
- 44 px targets;
- contrast tests;
- screenshot matrix;
- no raw colors in migrated screens;
- large text;
- VoiceOver/TalkBack checks.

**Done when**

- the player, Today, and Week can be rebuilt without introducing local primitives.

## 5. Phase 2 — Restructure the core loop

## 5.1 Today

Build:

- Start/Resume workout hero;
- compact daily check-in;
- calorie/protein progress and Log Meal;
- due measurement/reminder;
- one insight;
- profile/sync in header.

Remove/reduce:

- large water glass grid;
- unlabeled status badges;
- long streak strip;
- duplicated metric hierarchy.

**Success measures**

- median time to start workout;
- median time to add daily check-in;
- percentage of sessions launched from Today;
- first-action success rate.

## 5.2 Plan

Build:

- active week centered by date range;
- compact seven-day rows;
- day-detail sheet;
- Move/Swap/Rest/Start/Skip actions;
- target summary/edit;
- copy prior week.

Remove:

- hard-coded six-workouts target;
- judgment-only “Missed workout” state;
- “First week” primary control.

**Success measures**

- time to plan a three-day week;
- percentage of noncompleted workouts that are moved/closed intentionally;
- week-planning completion;
- number of accidental plan edits.

## 5.3 Train

Build:

- Today / Current Program / My Routines hierarchy;
- responsive set logger;
- previous/target/actual;
- rest timer;
- session-only versus routine-edit distinction;
- useful completion summary.

**Success measures**

- time per set entry;
- set correction rate;
- session resume success;
- sessions completed without leaving player;
- workout data-loss reports.

## 5.4 Fuel

First release:

- user macro targets including protein;
- recent/favorite meals;
- saved meals;
- copy from another day;
- quick-add totals clearly identified;
- past-date wording.

Second release:

- food data provider and portions;
- recipes;
- barcode;
- photo/voice only after manual/recent flow is fast.

**Success measures**

- time to log repeated meal;
- foods/meals logged per active day;
- copy/recent usage;
- day tracking completeness;
- correction rate after photo/voice.

## 5.5 Progress

Build:

- 1M/3M/6M/1Y/All;
- correct axes/tooltips;
- desired-rate corridor;
- workouts completed/planned;
- strength/volume trend;
- measurement trend;
- data completeness;
- one explainable insight.

**Success measures**

- weekly review completion;
- users who open Progress after four weeks;
- recommendation accept/edit/decline;
- ability to correctly explain trend in usability tests.

## 6. Phase 3 — Weekly Review and explainable adaptation

Introduce a Sunday/end-of-week ritual.

Inputs:

- plan completion;
- nutrition logging completeness;
- weight trend;
- target rate;
- strength performance;
- measurement cadence;
- user feedback: hunger, recovery, difficulty, schedule.

Outputs:

- keep/change calories;
- place next week’s workouts;
- progress one or more exercises;
- flag insufficient data;
- one behavioral suggestion.

Rules:

- deterministic and documented;
- recommendation includes “Why?”;
- user remains in control;
- no adjustment from low-confidence data;
- no punishment language.

## 7. Phase 4 — Ecosystem depth

Only after the core loop has strong retention:

- Apple Health / Health Connect;
- device-based steps/weight/workouts;
- multiple gym/equipment profiles;
- curated starter programs;
- progress photos;
- private accountability circles;
- Watch/Live Activity;
- smarter calorie and training recommendations.

Defer:

- public social feed;
- large program marketplace;
- generative coach;
- proprietary food database;
- broad medical/GLP-1 features.

## 8. Screen migration order

| Order | Screen | Reason |
|---:|---|---|
| 1 | Workout player | Core task and current P0 overflow |
| 2 | Sync/error surfaces | Trust and ability to test |
| 3 | Today | Orchestrates product value |
| 4 | Weekly Plan | Defines the plan Today executes |
| 5 | Workouts/editor | Supports Train hierarchy |
| 6 | Nutrition/add meal | Core repeated logging |
| 7 | Progress | Closes behavior loop |
| 8 | Measurements | Extends Progress |
| 9 | Profile/settings | Clean IA and data control |
| 10 | Auth/onboarding | Connect answers to new plan |
| 11 | Exercises | Compact library/detail |
| 12 | Friends | After privacy and value decision |
| 13 | Reminders | After new action hierarchy exists |

## 9. Research plan by phase

### Before Today/Plan redesign

Interview and task-test:

- beginners;
- intermediate lifters;
- users with irregular schedules;
- users who track nutrition;
- assistive-technology users.

Test:

- what belongs on Today;
- whether Sunday planning feels helpful;
- move/skip language;
- streak meaning.

### Before nutrition integration

Diary study for seven days:

- what people actually eat repeatedly;
- packaged versus homemade ratio;
- desired precision;
- whether calorie/protein estimates are sufficient;
- which capture method they would trust.

### Before adaptive recommendations

Concept test:

- recommended change;
- explanation;
- data-confidence indicator;
- accept/edit/keep controls.

Do not launch “AI coaching” until users can predict why a deterministic recommendation happened.

## 10. Analytics plan

Respect health-data sensitivity. Collect only product interaction needed to improve UX.

Recommended events:

- `today_primary_action_viewed`
- `today_primary_action_started`
- `checkin_opened/completed`
- `meal_log_started/completed/method`
- `workout_started/resumed/completed`
- `set_logged/corrected`
- `workout_moved/skipped`
- `week_plan_started/completed`
- `weekly_review_viewed/completed`
- `recommendation_accepted/edited/declined`
- `sync_attention_shown/recovered`
- `error_state_shown/retry_success`

Do not send raw health values in analytics event properties. Use coarse state such as `has_value`, `on_target`, or `method`.

## 11. Release gates

### Functional

- auth/config works;
- TypeScript/lint/tests/build pass;
- offline writes survive restart;
- deep links preserve intent;
- no data-sharing default regression.

### UX

- 90%+ task completion in formative testing for core tasks;
- no critical usability issue in player;
- no full-screen dead end;
- repeated meal under 10 seconds;
- three-day week plan under 90 seconds after routines exist.

### Accessibility

- all core controls labeled;
- 44 px targets;
- AA contrast;
- 200% text;
- screen-reader completion for sign-up, plan, workout, meal, progress.

### Visual

- screenshot tests at 320/390/430/768;
- no horizontal overflow;
- no overlays covering content;
- token-only color/type/spacing in migrated screens.

## 12. Backlog organized by priority

### P0

- Firebase configuration
- TypeScript build
- workout-player responsive row
- private-by-default sharing
- sync overlay
- friends recovery
- source corruption check

### P1

- action-led Today
- active week navigation
- compact weekly schedule
- move/skip/rebalance
- previous/target set context
- rest timer
- recents/saved meals and protein target
- Progress ranges/axes/insights
- accessibility primitives
- deep-link preservation
- canonical product rules

### P2

- exercise library compact/detail
- structured taxonomy
- measurement instructions/cadence/units
- native reminder pickers
- complete account/data settings
- curated programs
- weekly review rules

### P3

- health integrations
- multiple gym profiles
- progress photos
- private groups
- watch/lock-screen
- barcode/photo/voice
- adaptive calories/training

## 13. What not to do next

- Do not redesign every screen simultaneously.
- Do not add more dashboard cards to Today.
- Do not add generative AI before rule-based recommendations are trustworthy.
- Do not build a food database.
- Do not add a public feed.
- Do not preserve every current interaction merely because the data model supports it.
- Do not spend the first redesign cycle on new gradients, illustrations, or animation.

The product will feel dramatically better when it is safer, faster, clearer, and more connected—even if the palette remains almost unchanged.

