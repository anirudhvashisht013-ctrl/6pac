# Screen-by-Screen Competitive Analysis

## How to use this file

Each section compares the rendered 6Pac screen and source behavior with the closest competitor pattern. “Competitor pattern” does not mean copy the visual design. It identifies the user expectation the category has established.

Priority:

- **P0:** blocks entry, trust, or core use
- **P1:** materially harms repeated use
- **P2:** meaningful improvement after core loop
- **P3:** refinement

## 1. Startup, session restore, and routing

**6Pac now**

- Branded subtle splash.
- Firebase, auth, Firestore persistence, sync queue, fonts, and app shell initialize before entry.
- Startup failure has a dedicated recovery screen.
- After auth resolves, root navigation always replaces the current route with login, onboarding, or tabs.
- Native-intent handling maps every incoming path to `/`.

**Competitor expectation**

- Hevy/Strong/Fitbod preserve the active workout or intended deep link.
- Local/offline apps restore the last safe state without losing intent.
- Auth gates redirect back to the requested content after login.

**Gap**

- Shared workout links, reminder deep links, password reset links, and active-session routes cannot be trusted.
- Root replacement may override legitimate initial navigation.

**Redesign**

- Preserve an `intendedRoute`.
- Restore active workout first.
- Route invalid links to a branded recovery page.
- Show startup diagnostics only behind “Details.”

**Acceptance**

- A reminder opens the intended day.
- A friend-workout link returns to that workout after login.
- An active session resumes after process death.
- Unknown links provide Home and Back.

**Priority:** P1

## 2. Login

**6Pac now**

- Strong brand mark and tagline.
- Email/password, visibility toggle, forgot password, create account.
- Google hidden where unavailable.
- Raw Firebase errors can surface.

**Competitor pattern**

- MacroFactor/Fitbod explain trial/value near entry.
- Mature apps map technical errors, preserve input, and link Terms/Privacy.
- Offline-first products clearly distinguish account access from local data.

**Change**

- Replace raw errors with task language.
- Add privacy/terms.
- Add loading state that retains button label and layout.
- Explain why account is needed: backup, sync, friends.

**Acceptance**

- No `auth/*` or Firebase wording is user-visible.
- Keyboard does not cover actions.
- Password manager/autofill works.
- All controls have labels and 44 px targets.

**Priority:** P0 functional, P1 UX

## 3. Sign up

**6Pac now**

- Minimal three-field flow.
- Password minimum appears in placeholder.
- No terms/privacy text.
- Real attempt fails because Firebase rejects the configured key.

**Competitor pattern**

- Clear password requirements and inline validation.
- Legal/privacy acknowledgement.
- Email verification state if required.
- Value preview before collecting more profile data.

**Change**

- Put requirements below the field, not only in placeholder.
- Validate as the user types without scolding.
- Add Terms/Privacy links.
- After success, explain the six-step setup and estimated time.

**Acceptance**

- Production configuration passes CI validation.
- Duplicate email, weak password, network, and rate-limit errors are mapped.
- Submit remains reachable under keyboard and large text.

**Priority:** P0

## 4. Onboarding — identity and body data

**6Pac now**

- One question per screen.
- Name, DOB, sex, weight, height.
- Fixed kg/cm.
- Vague explanations.

**Competitor pattern**

- Fitbod asks experience, equipment, session length, and goals because it immediately generates training.
- MacroFactor asks inputs that drive an initial program and explains the coaching mode.
- Caliber connects answers to a recommended plan.

**Gap**

- Sensitive data is collected, while planning inputs that would produce visible value are absent.
- No unit choice.
- Text DOB field is error-prone.

**Change**

- Ask goal/schedule/equipment first.
- Move DOB/sex behind “Improve estimate” and explain the calculation.
- Add unit preference.
- Use a date picker or accessible segmented date field.
- Show optional status explicitly.

**Acceptance**

- Every question states what changes because of the answer.
- User may skip nonessential personal fields.
- Inputs support metric/imperial.
- Large text does not clip progress/header.

**Priority:** P1

## 5. Onboarding — goal

**6Pac now**

- Lean Body, Body Recomp, Buffed Body.
- Each has short physique copy.
- Goal is said to guide the weekly plan, but no plan appears after completion.

**Competitor pattern**

- MacroFactor uses lose/maintain/gain plus rate and program style.
- Fitbod uses measurable training goals and experience.
- Caliber combines outcome, schedule, and program.

**Gap**

- Branded labels are ambiguous.
- No target rate, timeline, or guardrail.
- The promise is not fulfilled immediately.

**Change**

- Use “Lose fat,” “Recompose,” “Build muscle,” “Maintain.”
- Ask preferred pace with safe recommendation.
- Finish with a generated first-week review.
- Explain that the plan can change.

**Acceptance**

- User can explain what their selected goal will change.
- Completion produces targets and a week—not an empty dashboard.

**Priority:** P1

## 6. Today — top

**6Pac now**

- Metric-entry streak.
- Date navigation.
- Five unlabeled status icons.
- Weight, sleep, steps, water.
- No workout action.

**Competitor pattern**

- MyFitnessPal’s current Today consolidates diary, calories, macros, and habits.
- Fitbod opens around the generated workout.
- MacroFactor surfaces coaching/food/weight actions based on state.
- Hevy makes the next workout one tap away.

**Gap**

- 6Pac knows the plan but does not act like a plan.
- The first viewport is mostly status and controls.

**Change**

Wireframe:

```text
[Sun, Jun 28]                           [Avatar]

[Start Push Strength · 52 min]              >
[2 of 4 daily check-ins complete]           >

Fuel                         1,980 / 2,200 kcal
Protein                            140 / 165 g
[Log meal]

Recovery
Sleep 6.7h   Steps 6,500   Water 2.0/2.5L

Insight
Weight trend is down 0.2 kg/week.
```

**Acceptance**

- The next workout is visible without scrolling.
- Log meal and daily check-in are one tap.
- Every status icon has a visible or accessible label.
- Today still works on a rest day and with no plan.

**Priority:** P1

## 7. Today — lower metrics, calories, notes

**6Pac now**

- Large water glass grid.
- Supplements switch.
- Calorie card.
- Macro totals.
- Notes.

**Competitor pattern**

- MacroFactor favors compact, time-based food logging.
- Cronometer lets users drill into nutrient detail.
- Strong/Hevy keep nonessential data outside the core workout task.

**Gap**

- Water occupies disproportionate space.
- Macro totals lack target context.
- Notes are disconnected from training/recovery.

**Change**

- Replace glasses with progress + `+250`, `+500`, custom.
- Protein gets target priority for physique users.
- Move notes into “Daily reflection” collapsed by default.
- Add data-source links: meals, workout, steps.

**Acceptance**

- Full Today loop fits in roughly 1.5 phone viewports.
- Water does not create more controls as target rises.
- Calories/macros link directly to Fuel.

**Priority:** P1

## 8. Streak

**6Pac now**

- 30-day horizontal list of identical arm icons.
- Score is based on weight, sleep, water, and steps.
- Tapping opens a native alert.
- Product overview says streak is completed workouts.

**Competitor pattern**

- Hevy uses training streak/history.
- Habit apps show dated grids with clear completion rules.
- MacroFactor avoids shaming adherence.

**Gap**

- Rule mismatch and unclear icons.
- Rewards data entry rather than the product outcome.

**Change**

- Rename to “Consistency.”
- Use a 7-day row with dates and meaningful states.
- Let user choose focus: workouts, check-ins, or plan adherence.
- Do not break streaks on planned rest.

**Acceptance**

- User can state the rule without opening help.
- Rest, missed, partial, and complete are distinguishable without color.

**Priority:** P1

## 9. Weekly Plan — navigation and summary

**6Pac now**

- “First week,” arrows, “This week,” horizontal week chips.
- With history, chips begin at the earliest range and active week may be off-screen.
- Repeated month/year labels.

**Competitor pattern**

- Calendar products center the selected period.
- Boostcamp shows current program week and progression.
- MacroFactor weekly check-in emphasizes the current decision.

**Gap**

- The user cannot reliably locate the active week.
- “First week” has little everyday value.

**Change**

- Header: `Jun 22–28` with previous/next and calendar.
- Auto-center active week.
- Show `Week 4 of 8` only for a program.
- Put historical summary in a dedicated review.

**Acceptance**

- Selected week is always visible.
- “This week” returns and scrolls correctly.
- Date range uses locale and year only when needed.

**Priority:** P0/P1

## 10. Weekly targets

**6Pac now**

- Calories, steps, water, target weight, lose/maintain/gain.
- Free-text numeric fields.
- Protein absent.

**Competitor pattern**

- MacroFactor recommends and explains calorie/macro changes.
- Cronometer supports detailed custom targets.
- Fitbod/Caliber connect training target and plan.

**Gap**

- Targets look authoritative but are manual and unexplained.
- No recommended range, pace, or weekly context.

**Change**

- Summary card with current targets and source: Manual / Recommended.
- Weekly check-in proposes deltas.
- Add protein.
- Allow different training/rest-day calories in collaborative mode.

**Acceptance**

- Values validate ranges/units.
- Every recommendation has “Why?”
- User can accept, edit, or keep current.

**Priority:** P1

## 11. Daily schedule

**6Pac now**

- One large card per day.
- Workout/rest/unplanned.
- Three unlabeled adherence icons.
- “Missed workout.”

**Competitor pattern**

- Boostcamp/Caliber focus on program day, completion, and next target.
- Calendar apps support move/reschedule.
- MacroFactor uses neutral deviations.

**Gap**

- Too much vertical space.
- No recovery action after change.

**Change**

```text
Mon 22   Push Strength              Complete
Tue 23   Pull Hypertrophy           Move · Do now
Wed 24   Rest                       Rest
Thu 25   Pull Hypertrophy           Not completed
```

Tap opens day detail with Move, Swap, Rest, Start, Skip.

**Acceptance**

- Seven days fit in one to two viewports.
- Every noncompleted workout has a recovery action.
- Indicators have labels/tooltips.

**Priority:** P1

## 12. Day-planning modal

**6Pac now**

- Rest option, workout search, list, cancel.
- Updates immediately after selection.

**Competitor pattern**

- Program tools show workout focus, duration, equipment, and conflicts before selection.

**Gap**

- Names/notes are insufficient for choosing.
- No move/copy action.
- No confirmation when changing today or a past day.

**Change**

- Show compact program metadata.
- Add “Move existing workout” and “Copy previous week.”
- If active session exists, explain effect.

**Acceptance**

- Search/filter by muscle, duration, equipment.
- Current selection is announced.
- Change remains reversible.

**Priority:** P2

## 13. Workouts

**6Pac now**

- Today’s Workout card.
- Template list and quick play.
- Today’s template duplicated below.
- Any template play button is enabled if any planned day exists.

**Competitor pattern**

- Hevy: routines and fast start.
- Strong: minimal list.
- Boostcamp: program context and current week.
- MacroFactor Workouts: structured program plus one-off workout.

**Gap**

- Quick play semantics do not match the weekly plan.
- “Template” language feels technical.

**Change**

- Sections: Today, Current Program, My Routines.
- Quick start opens “Start as extra workout?” when unscheduled.
- Use overflow for edit/duplicate/share/delete.
- Private badge visible.

**Acceptance**

- Starting a routine clearly states whether it affects the plan.
- No long-press-only destructive action.
- Today’s item is not needlessly duplicated.

**Priority:** P1

## 14. Workout editor

**6Pac now**

- Name, notes, ordered blocks.
- Up/down/edit/delete controls.
- Clear visual grouping.

**Competitor pattern**

- Hevy/Strong emphasize sets, reps, timer, and supersets.
- Boostcamp supports progression and multi-week program logic.
- MacroFactor Workouts adds RIR and smart progression.

**Gap**

- Block summary hides the actual prescription.
- No program/week context or estimated duration.

**Change**

- Summary: `Bench Press · 4 × 8–10 · 1–2 RIR · 90s`.
- Drag handle + overflow.
- Show duration and working-set totals.
- Sharing default/visibility near Save.
- Program progression is a later layer.

**Acceptance**

- User can audit the whole workout without opening every block.
- Delete/duplicate/edit are labeled.
- Unsaved changes prompt on exit.

**Priority:** P1

## 15. Add/edit workout block

**6Pac now**

- Exercise, cardio, or rest.
- Exercise chosen from library.
- Notes, duration, quick rest values.

**Competitor pattern**

- Strong/Hevy provide previous configuration defaults.
- MacroFactor supports set types, RIR, timer, warm-ups.

**Gap**

- No clear required-field validation until save.
- Advanced options have no hierarchy.

**Change**

- Basic: exercise, working sets, rep range.
- Training details: RIR/RPE, rest, tempo, set types.
- Defaults from last use/exercise.
- Preview row before commit.

**Acceptance**

- Beginner can add an exercise with three decisions.
- Advanced options remain available.
- Invalid values explain the fix inline.

**Priority:** P1

## 16. Exercise library

**6Pac now**

- Rich tall cards.
- Search.
- Delete icon per card.
- Metadata and cues visible.

**Competitor pattern**

- Fitbod/MacroFactor provide large curated libraries with controlled taxonomy and demos.
- Hevy keeps the list compact and opens detail.

**Gap**

- Scan cost and card height are high.
- Destructive action is overexposed.

**Change**

- Compact row: name, primary muscle, equipment, usage.
- Filter/sort chips.
- Detail screen for cues, videos, alternatives.
- Overflow for edit/delete.

**Acceptance**

- 6–8 exercises visible per viewport.
- Search/filter state persists.
- Destructive action has label and undo/confirmation.

**Priority:** P2

## 17. Exercise creation

**6Pac now**

- Long sheet with name, cues, movement type, muscle strings, equipment, video URLs, alternatives.

**Competitor pattern**

- Mature libraries use structured muscle/equipment options.
- Custom exercise creation starts with a small required set.

**Gap**

- Free-text taxonomy will fragment filtering and analytics.
- Too many decisions for first save.

**Change**

- Required: name, movement pattern/type, primary muscle, equipment.
- Optional advanced: targets, cues, videos, alternatives.
- Controlled options + Custom.
- Duplicate detection.

**Acceptance**

- Save a basic custom exercise in under 30 seconds.
- Duplicate normalized names are flagged.
- Advanced data can be added later.

**Priority:** P2

## 18. Workout player — exercise block

**6Pac now**

- Exercise title, set rows, add set, complete, videos, next block, end workout.
- Alternative swap.
- Set table overflows 390 px.

**Competitor pattern**

- Hevy/Strong show previous set and target while keeping actual entry central.
- MacroFactor Workouts adds explicit progression/RIR.
- Caliber emphasizes progressive-overload context.

**Gap**

- Core controls are unreachable/truncated.
- No previous or suggested values.
- Destructive delete consumes horizontal space.

**Change**

```text
Barbell Bench Press                   1 / 4
Target 4 × 8–10 · 1–2 RIR

Set 1   Previous 70×9
[70 kg] [9 reps]                 [Complete]

Rest 01:28                        [Skip]
```

- Stack actual fields on narrow screens.
- Swipe/overflow delete.
- Copy previous and repeat last set.
- Disable complete until required data or confirm intentional skip.

**Acceptance**

- 320 px, large text, and keyboard-open all work.
- Set entry requires no horizontal scroll.
- Previous/target/actual are distinguishable.
- Every set saves locally immediately.

**Priority:** P0

## 19. Workout player — rest/cardio

**6Pac now**

- Rest block has countdown and next exercise.
- Cardio records minutes completed.

**Competitor pattern**

- Hevy/Strong use between-set timers automatically.
- Fitbod supports duration-aware sessions and cardio/mobility.

**Gap**

- Rest as a playlist block does not replace between-set rest.
- Cardio records minutes but limited intensity/distance/context.

**Change**

- Exercise-level rest timer starts on set completion.
- Keep explicit rest blocks for circuits/transitions.
- Cardio supports duration plus optional distance/intensity.
- Timer survives backgrounding and lock.

**Acceptance**

- Timer state persists.
- Audio/haptic has visual equivalent.
- User can skip/add time.

**Priority:** P1

## 20. Workout playlist

**6Pac now**

- Current locked, upcoming reorder/edit/delete, add block, Save.

**Competitor pattern**

- Adaptive apps distinguish session edits from program edits.
- Drag handles are a familiar reorder pattern.

**Gap**

- Dense controls.
- Ambiguous save scope.

**Change**

- Drag upcoming blocks.
- Overflow edit/delete.
- “Apply to this workout” primary action.
- Secondary option “Also update routine.”

**Acceptance**

- Current/completed blocks cannot move.
- Scope of changes is explicit.
- Undo exists for deletion.

**Priority:** P1

## 21. Workout completion

**6Pac now**

- Trophy, workout name, duration, remote/fallback quote, Done.

**Competitor pattern**

- Hevy/Caliber celebrate PRs and show useful summary.
- MacroFactor Workouts connects completion to progression.

**Gap**

- A generic quote is less valuable than the user’s own result.
- Remote quote introduces network dependency and attribution clutter.

**Change**

- Duration, sets, volume, PRs, muscles, plan completion.
- “Next time” progression preview.
- Optional share card.
- Reflection: difficulty/RIR and note.

**Acceptance**

- Summary works offline.
- Personal result is primary; quote is optional/removed.
- User can correct session before closing.

**Priority:** P2

## 22. Nutrition

**6Pac now**

- Date chips, calorie target, fixed macro bars, meal totals, add/edit sheet.

**Competitor pattern**

- MacroFactor: fast recents, recipes, history, adaptive targets.
- Cronometer: verified source and nutrient detail.
- MyFitnessPal: broad food/restaurant search and copy workflows.

**Gap**

- Manual aggregate entry only.
- Fixed macro maxima.

**Change**

- Diary grouped by meal/time.
- Add options: Recent, Saved Meal, Search/Scan, Quick Add.
- User protein/carb/fat targets.
- Copy meal/day.
- Weekly budget context.

**Acceptance**

- Repeat yesterday’s breakfast in under 10 seconds.
- Quick add remains possible.
- Macro bars reflect actual target.
- Past-date labels do not say “today.”

**Priority:** P1

## 23. Add/edit meal

**6Pac now**

- Name, notes, calories, protein, carbs, fat.
- One long form.

**Competitor pattern**

- Food apps distinguish food items, meals, recipes, and quick totals.

**Gap**

- “Chicken with rice” cannot be reused as structured ingredients/portion.

**Change**

- Explicit “Quick add meal totals” label for current form.
- Separate Saved Meal/Recipe builder later.
- Recents first.
- Validate calories against macros only as a nonblocking warning.

**Acceptance**

- User understands manual estimate status.
- All numeric fields accept zero intentionally where relevant.
- Save errors are inline and recoverable.

**Priority:** P1

## 24. Profile hub

**6Pac now**

- Identity card.
- Progress, Measurements, Friends, Exercises, Notifications.
- Sync, export, seed data, logout lower down.
- Sync overlay can cover content.

**Competitor pattern**

- Primary product destinations stay in primary navigation.
- Settings groups account/privacy/preferences separately.

**Gap**

- Profile is a catch-all.

**Change**

- Move Progress to tab.
- Train owns Exercises.
- Profile menu: Account, Preferences, Notifications, Data & Sync, Privacy, Friends.
- Replace global sync overlay with header state.

**Acceptance**

- No overlay covers content or nav.
- Delete account and export are findable.
- Development tools are separated.

**Priority:** P0 overlay, P1 IA

## 25. Edit Profile

**6Pac now**

- Only Full Name editable; helper admits this.

**Competitor pattern**

- Account profile and health profile are separate.
- Units, goals, body data, and preferences can be changed with consequences explained.

**Gap**

- A dedicated screen for one field feels unfinished.

**Change**

- Account: name/email/password.
- Health profile: DOB/sex/height/current goal.
- Preferences: units/time/week start.
- Explain recalculation effects.

**Acceptance**

- Every onboarding answer can be corrected.
- Sensitive changes are validated and logged.

**Priority:** P2

## 26. Progress

**6Pac now**

- Current weight, workout days, 7-day average, fixed 3-month range, 14-day adherence.
- Chart labels are misleading.

**Competitor pattern**

- MacroFactor: trend, rate, goal corridor, expenditure, check-in.
- Hevy/Strong: per-exercise volume/1RM/PR.
- Caliber: combined activity/body/habit charts.

**Gap**

- Does not answer whether the plan works.

**Change**

- Overview: weight trend vs desired rate, workouts completed/planned, protein/calorie adherence.
- Training: strength and volume.
- Body: measurements/photos.
- Range selector and explanations.
- Weekly recommendation.

**Acceptance**

- Axes have date and unit.
- User can inspect a data point.
- Data completeness and period are explicit.
- No claim is made from insufficient data.

**Priority:** P1

## 27. Body measurements

**6Pac now**

- Month tabs, next slot, current/previous/delta, CSV.
- 15-day cadence.

**Competitor pattern**

- MacroFactor Workouts/Caliber combine photos, body metrics, and trend.
- Good measurement tools teach technique and consistency.

**Gap**

- No instructions, unit preference, configurable cadence, or photo.

**Change**

- Measurement guide.
- User cadence: 2/4 weeks/custom.
- Goal-neutral delta color.
- Optional private progress photos.
- Trend chart for selected measure.

**Acceptance**

- Units follow preference.
- Every field has anatomical guidance.
- Photos are private by default with storage explanation.

**Priority:** P2

## 28. Measurement form

**6Pac now**

- Two-column inches fields, body fat, notes, Save.

**Competitor pattern**

- Health forms support unit choice, previous value, and technique cues.

**Gap**

- Two columns can fail at large text.
- Arms/Biceps naming is unclear.
- No previous value during entry.

**Change**

- One-column responsive field list.
- Previous value and optional “copy.”
- Diagram/help per field.
- Save partial measurements intentionally.

**Acceptance**

- 200% text works.
- User knows which anatomical point to measure.
- Partial versus missing is explicit.

**Priority:** P2

## 29. Friends dashboard

**6Pac now**

- Friend ID, counts, tabs for added/incoming/search, template-sharing controls.
- Cloud failure shows only “Unable to load friends.”

**Competitor pattern**

- Hevy uses social motivation and routine copying.
- Caliber uses private groups.

**Gap**

- Dead-end recovery.
- Default sharing risk.
- Too many jobs in one screen.

**Change**

- Error screen with Back, Retry, last-known state.
- Private by default.
- Separate Friends, Requests, Shared routines.
- Consider private accountability circles instead of public feed.

**Acceptance**

- Failure never removes navigation.
- Sharing state is visible before sending.
- Blocking/removal/privacy are findable.

**Priority:** P0

## 30. Friend detail and shared workouts

**6Pac now**

- Shared-workout count, list, search, copy, remove friend with two confirmations.

**Competitor pattern**

- Hevy provides preview and social context.
- Boostcamp preserves program source/version.

**Gap**

- Copy lacks a rich preview and source/version semantics.

**Change**

- Preview blocks, duration, focus, equipment.
- Show owner/source and copied date.
- Copy as private by default.
- Offer “Copy and edit.”

**Acceptance**

- Copy is idempotent.
- No future owner edit mutates user copy.
- Source attribution remains visible.

**Priority:** P2

## 31. Notifications and reminders

**6Pac now**

- Master, permission, four reminders, quiet hours, raw time text, save.

**Competitor pattern**

- Mature apps ask permission in context and show the next scheduled event.

**Gap**

- Long settings form and technical copy.

**Change**

- Native time picker.
- Autosave per row.
- Next-fire preview.
- Ask for permission when user enables first reminder.

**Acceptance**

- Invalid time is impossible.
- Timezone changes update predictably.
- Quiet hours explain overnight behavior.

**Priority:** P2

## 32. Sync and offline

**6Pac now**

- Global indicator, profile status, manual sync, pending queue.
- Surface can cover content.

**Competitor lesson**

- Hevy outage feedback shows that users fear lost workouts even when local data may exist.
- Offline confidence needs a visible mental model.

**Change**

States:

- `Saved` — no UI noise.
- `Saved on device` — small cloud-off icon when offline.
- `Syncing 4 changes` — header state.
- `Sync needs attention` — in-layout banner with Retry.

**Acceptance**

- Local success is confirmed before cloud success.
- App restart preserves pending data.
- Logout cannot silently discard changes.
- Detail screen identifies affected collection in development only.

**Priority:** P0

## 33. Not found and blocking errors

**6Pac now**

- Generic template styling, hard-coded blue, default font.
- Friends blocking error has no navigation.

**Competitor expectation**

- Branded, calm recovery with preserved context.

**Change**

- Shared ErrorState component.
- Plain-language title, impact, primary recovery, secondary Home/Back.
- Technical details only under disclosure.

**Acceptance**

- Every full-screen error has at least one working exit.
- Error styling meets design tokens and accessibility.

**Priority:** P1

## 34. Recommended new screen: Weekly Review

This screen does not exist but is the missing bridge between tracking and coaching.

**Benchmark**

- MacroFactor weekly check-in.
- Caliber weekly coaching review.
- Program progression in Boostcamp/MacroFactor Workouts.

**Content**

```text
Your week
4 of 5 planned workouts completed
Weight trend: −0.2 kg/week (goal −0.3)
Calories tracked: 6 of 7 days
Protein target met: 5 days

Suggested next week
Keep calories at 2,200
Move Pull day away from Thursday conflict
Add 2.5 kg to bench if you reach 10 reps

[Review next week]  [Keep current plan]
```

**Rules**

- Recommendation is explainable.
- User can keep current values.
- Insufficient data leads to a data-quality suggestion, not a false adjustment.

**Priority:** P1

## 35. Recommended new screen: Day Detail

The current product scatters one day across Today, Week, Workouts, and Nutrition.

**Content**

- workout/rest state;
- meal/calorie/protein summary;
- recovery metrics;
- notes;
- move/swap/start workout;
- log meal/check-in;
- completion state.

Today is the current day’s Day Detail; Week opens it for any day.

**Priority:** P1

