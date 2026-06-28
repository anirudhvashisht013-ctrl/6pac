# 6Pac UI/UX Audit

## 1. Audit conclusion

6Pac has a credible visual shell around an overextended product model.

The cyan-on-near-black brand is distinctive, Outfit is used consistently, cards and status colors feel related, and the app has more thoughtful state handling than a typical early prototype: undoable deletion, local-first persistence, reminder logic, week history, exercise alternatives, session snapshots, measurement cadence, and export are all signs of serious product thinking.

The experience is still difficult to trust and difficult to understand as a whole:

- the main screen does not answer “what should I do next?”;
- planning, workout execution, nutrition, daily metrics, and progress act like separate tools;
- important behavior is hidden behind unlabeled icons;
- high-density screens rely on long vertical scrolling;
- the workout player fails responsively at a common phone width;
- progress explains very little about why numbers changed;
- system states can cover content or become dead ends;
- several product promises in `APP_OVERVIEW.md` no longer match the implementation.

The redesign should not begin with a new color palette. It should begin with a simpler product hierarchy, a fast daily loop, safer defaults, and a real component system.

## 2. Product model found in the source

The current product contains six overlapping systems:

1. **Account and personalization**
   - email/password authentication;
   - native Google authentication where available;
   - six-step onboarding;
   - profile and sync.

2. **Daily adherence**
   - weight, sleep, steps, water, supplements, notes;
   - metric-based streak;
   - calorie and macro rollup.

3. **Weekly planning**
   - workouts/rest days across Monday–Sunday;
   - weekly calorie, step, water, weight, and weight-direction targets;
   - historical/future week navigation;
   - weekly summaries.

4. **Training**
   - reusable exercise library;
   - workout templates composed of gym/cardio/rest blocks;
   - in-session set logging;
   - live playlist editing;
   - reference video support;
   - workout sharing.

5. **Nutrition and physique**
   - manual meal totals;
   - body measurements on a 15-day cadence;
   - weight trend and adherence.

6. **Social and operational support**
   - friend IDs and requests;
   - shared workout copying;
   - reminders;
   - local-first sync;
   - CSV export.

That breadth is an asset, but there is no single hierarchy tying it together. The user must learn the system architecture before the app starts feeling simple.

## 3. Primary jobs to be done

### Job A — Decide what to do today

> When I open the app, tell me the smallest set of actions that will keep my plan moving.

Current fit: weak. Today shows tracking controls but not today’s workout, meal logging, pending measurement, or meaningful recovery context.

### Job B — Execute a workout without breaking focus

> While I train, help me record sets and make the next progression decision with as little typing and navigation as possible.

Current fit: medium-low. Sessions persist and blocks are editable, but the set table overflows and lacks last performance, target range, suggested load, RIR/RPE, and an integrated visible rest timer.

### Job C — Understand whether the plan is working

> Show me whether my weight, strength, adherence, and measurements are moving in the intended direction, and tell me what to adjust.

Current fit: low. Trends are minimal and disconnected. “Adherence” is shown, but the app does not translate it into an explanation or recommendation.

### Job D — Recover gracefully when life changes

> Let me move a workout, miss a day, change equipment, or eat differently without making the plan feel broken.

Current fit: medium. Exercise swaps and planning edits exist, but “missed workout” is punitive, full-plan rules are inconsistent, and there is no explicit reschedule/recovery workflow.

### Job E — Trust my history

> Save everything immediately, make sync understandable, and never surprise me about privacy or data loss.

Current fit: medium-low. The local-first architecture is promising, but cloud configuration, sync overlays, default sharing, and error recovery erode trust.

## 4. What is already working

### A coherent visual direction

- Dark surfaces, cyan primary action, orange secondary, violet accent, green success, amber warning, and red error create a recognizable palette.
- Outfit provides a consistent, approachable brand voice.
- Cards, pills, outlines, and iconography generally look like parts of one product.
- Screens are visually calmer than feature-heavy competitors such as MyFitnessPal or Cronometer.

### Useful local-first behavior

- Domain repositories save locally before best-effort mirroring.
- Workout sessions embed a block snapshot, reducing the chance that later template edits corrupt history.
- The UI exposes sync state and a manual sync control.
- Unit tests cover important boundary and projection logic.

### Several good interaction decisions

- Meal and template deletion use an undo toast rather than an immediate irreversible confirmation.
- Workouts can be resumed.
- Exercises can have alternatives and reference videos.
- The workout playlist distinguishes locked/current/upcoming blocks.
- Measurement slots prevent accidental future logging.
- Reminder settings include quiet hours and separate notification permission.

### Thoughtful domain depth

- Rest and cardio are first-class workout blocks.
- Weekly planning, targets, and daily data are connected.
- Measurements include bilateral fields.
- Friends can copy a template without creating a shared mutable dependency.

These strengths should be preserved. The problem is not lack of features; it is how those features are prioritized, explained, and safely composed.

## 5. UX scorecard

| Dimension | Score | Assessment |
|---|---:|---|
| Value proposition | 6/10 | “Plan, track, improve” is present, but the app does not yet turn breadth into a clear promise. |
| First-run experience | 5/10 | Visually clean; asks for data without showing the payoff or privacy rationale. |
| Information architecture | 4/10 | Five tabs are understandable, but Progress, Exercises, Friends, Reminders, sync, and export are buried in Profile. |
| Daily usefulness | 4/10 | Daily metrics are easy to see; the next workout and nutrition action are missing. |
| Workout planning | 5/10 | Capable templates and week plan; navigation and rules are confusing. |
| Workout execution | 4/10 | Strong domain model, weak responsive layout and progression support. |
| Nutrition | 3/10 | Attractive summary but only manual aggregate meal entry. |
| Progress and insight | 4/10 | Real trend calculations, insufficient controls, axes, explanations, and recommendations. |
| Error prevention | 4/10 | Undo patterns help; default sharing and permissive workout completion are risky. |
| Error recovery | 3/10 | Friends is a dead end; auth cannot complete; several async screens lack actionable retries. |
| Accessibility | 2/10 | Contrast and semantic-label failures are widespread. |
| Cross-platform resilience | 3/10 | Mobile-first visually, but core player overflows and web/deep-link behavior is weak. |
| Trust and privacy | 3/10 | Local-first is a good foundation; defaults and system failures undermine it. |

## 6. Information architecture audit

### Current bottom navigation

1. Today
2. Weekly Plan
3. Workouts
4. Nutrition
5. Profile

This arrangement treats “Progress” as a profile setting even though progress is one of the product’s main rewards. It also treats Exercises and Friends as account configuration, although both are active product areas.

### Recommended navigation

1. **Today** — next actions, status, quick logging
2. **Plan** — week schedule and targets
3. **Train** — active workout and programs/templates
4. **Fuel** — food log and nutrition targets
5. **Progress** — weight, strength, measurements, adherence

Profile/settings should open from an avatar in the top-right of Today or Progress. Friends can be a section within Train or a lightweight “Community” destination reached from the profile/avatar menu until social value is proven.

### Why this is better

- The five tabs map to five user jobs, not five data types.
- Progress becomes a reward loop, not a buried report.
- Profile stops being a dumping ground.
- “Plan” and “Train” become distinct: decide versus execute.
- Today can orchestrate the other areas without duplicating them.

## 7. Critical cross-product findings

### 7.1 Today is a form, not an operating system

The screen opens with a metric streak, date navigation, five unlabeled status icons, three metric cards, a large water control, supplements, calories, and notes. Today’s workout is absent. Adding a meal requires switching tabs. Pending reminders are rendered elsewhere.

**Impact:** the user must translate data into action.

**Recommendation:** make Today a prioritized feed:

1. primary action: Start/Resume today’s workout;
2. nutrition progress with “Log meal”;
3. compact daily check-in row;
4. pending measurement/reminder;
5. one insight or encouragement;
6. optional notes.

Use disclosure: show the current value and a one-tap action; edit detail in a bottom sheet.

### 7.2 The plan does not adapt

The weekly plan labels past uncompleted sessions “Missed workout,” but provides no “Move,” “Skip with reason,” “Do today,” or “Rebalance week” action. A user’s week changes; the app currently records failure rather than helping recover.

**Recommendation:** support:

- move workout to another day;
- mark intentionally skipped;
- convert to rest/recovery;
- start a different planned workout;
- show effect on weekly volume;
- offer an end-of-week “carry forward or close” review.

### 7.3 Tracking depth is uneven

Workout templates have considerable domain richness while nutrition stores only user-entered calorie/macro totals. Progress has a real 7-day moving average but only a fixed three-month range and basic adherence.

**Recommendation:** decide the product’s depth contract:

- core actions should all be fast;
- advanced depth should be available on demand;
- no area should look “complete” while lacking the minimum workflow users expect from that category.

For nutrition, the minimum credible workflow is recents/favorites, reusable meals/recipes, serving amounts, and barcode or a reliable food-data integration.

### 7.4 The product is internally inconsistent

Examples:

- `APP_OVERVIEW.md` says the full week must be planned before workouts unlock. The current Workouts screen allows planned days to start while other days remain unplanned.
- The overview describes a workout-completion streak. The current Streak component scores weight, sleep, water, and steps.
- The overview says long-term progress has 1/3/6/12-month controls. The implementation fixes the range to three months.
- Workouts can be shared from Friends, but new templates initialize `sharedWithFriends` to `true`, making the privacy model opt-out.

**Recommendation:** define product rules in one canonical spec, test them, and use the same language in UI, documentation, analytics, and support.

## 8. Flow audit

### 8.1 Authentication

**Good**

- Clean hierarchy.
- Clear email/password fields.
- Password visibility toggle.
- Reset-password link.
- Sign-up and sign-in are visually distinct.

**Problems**

- The checked-in API key is rejected by Firebase; real sign-up fails with a raw Firebase error.
- Sign-up has no Terms, Privacy, or consent text.
- The Firebase error exposes implementation language instead of a user-safe recovery message.
- Native Google availability differs by platform without an explanatory fallback.
- No clear offline/auth-state expectation for a “local-first” product.

**Required changes**

- Validate production Firebase configuration in CI and at build time.
- Map all auth errors to plain language.
- Add Terms and Privacy acknowledgement.
- Preserve entered email after an error.
- Show “Continue with Google” only where it works, with no layout jump.

### 8.2 Onboarding

The six screens are name, date of birth, biological sex, body weight, height, and goal.

**Good**

- One question per screen.
- Strong progress cue.
- Back navigation preserves answers.
- Large selection cards on the goal screen.

**Problems**

- The user gives sensitive data before seeing a personalized result.
- “Used to calculate fitness metrics” is vague; the app does not visibly calculate or explain those metrics.
- DOB is a formatted text field rather than a date picker with validation and age explanation.
- Units are fixed to kg/cm while measurements later use inches.
- “Lean Body,” “Body Recomp,” and “Buffed Body” are brand-like labels, not measurable goals.
- “Biological sex” plus “Other” is not enough to explain which calculation path the app uses.
- No training experience, days available, equipment, nutrition preference, or reminder preference is collected, even though the product revolves around planning.
- Completing onboarding does not produce a visible recommended plan.

**Recommended onboarding**

1. goal outcome and target pace;
2. training experience;
3. available days and typical session length;
4. equipment/gym profile;
5. current weight and optional height/DOB/sex with clear rationale;
6. units and reminder preference;
7. review the generated first week and targets;
8. let the user edit before confirming.

Defer nonessential personal data. Show “Why we ask” inline.

### 8.3 Today

**Good**

- Past-day editing is now possible.
- Water logging is fast.
- Metric cards have clear values.
- Notes and supplements are lightweight.
- Calories roll up from meals.

**Problems**

- The five status icons have no visible labels or legend.
- A long horizontal strip of identical arm icons does not communicate dates or metric scores.
- The streak is based on data entry, which can reward logging rather than health behavior.
- Water renders one control per 250 ml; large targets create a crowded grid.
- Daily Metrics uses two half-width cards and one full-width card without a meaningful reason.
- Calories and notes fall below the first viewport.
- No workout card, meal action, measurement action, or “day complete” summary.
- Numeric edit sheets do not show valid ranges, units in the input, or clear errors.
- Saving has limited failure recovery.

**Recommended layout**

- Header: date, avatar, sync only when attention is required.
- “Next up” hero: Start/Resume workout or recovery/rest guidance.
- Daily check-in: five compact labeled metrics.
- Fuel: calorie/protein status plus Log Meal.
- Recovery: sleep/steps/water in a compact row.
- Pending: measurement/reminder only when due.
- Insight: one sentence grounded in recent trends.

### 8.4 Weekly Plan

**Good**

- Rest and workout days are explicit.
- Targets and schedule appear together.
- Historical and future bounds exist.
- Daily cards show adherence and completed sessions.
- Workout search is available in the day picker.

**Problems**

- With history, the horizontal week strip opens at the earliest week instead of the selected/current week.
- Month/year chips repeat and are hard to distinguish; the active week can be off-screen.
- “First week” is an implementation-oriented control, not a user goal.
- Cards are too tall; only a few days fit on screen.
- Calorie/steps/water icons are unlabeled and rely on color.
- “Missed workout” is a judgment with no recovery action.
- A hard-coded six-workouts-per-week target influences summary logic regardless of user plan.
- Weekly targets are free text without recommended ranges or validation feedback.
- Changing a plan for a past or active week has no clear consequence explanation.

**Recommended layout**

- Sticky week header with date range, “This week,” and a calendar picker.
- Auto-center active week.
- Compact seven-row schedule with day, plan, completion, and overflow menu.
- Day-detail sheet for move/swap/rest/start.
- Targets summarized in one card; edit in a dedicated sheet.
- Weekly review that distinguishes planned, completed, moved, intentionally skipped, and missed.

### 8.5 Workouts and templates

**Good**

- Today’s workout is prominent.
- Template cards are clean and compact.
- Empty state provides a direct create action.
- Blocks support exercise, rest, and cardio.
- Deletion is undoable.

**Problems**

- Today’s template is duplicated immediately below in Templates.
- Play buttons on every template are enabled whenever *any* day in the week is planned, not when that template is appropriate for today.
- Long-press deletion is undiscoverable and risky as the only gesture.
- Template cards omit sets, rep targets, estimated duration, last run, and next progression.
- “Templates” is authoring language; users may think in Programs/Routines.
- New templates default to shared.

**Recommendation**

- Separate “Today” from “Programs.”
- Use an overflow menu for edit/duplicate/share/delete.
- Make sharing private by default.
- Show estimated duration, block count, muscle focus, and last completion.
- Let a user start an unplanned workout, but label it clearly and ask whether to update the week.

### 8.6 Workout editor

**Good**

- The existing editor is visually one of the clearest screens.
- Reordering controls are explicit.
- Blocks have distinct visual identities.
- Adding/editing occurs without leaving the workflow.

**Problems**

- Block rows do not surface sets × reps, RIR, progression, or exercise alternatives.
- Four separate small controls per row increase target density.
- Delete is icon-only.
- No estimated workout duration or volume preview.
- No validation summary before save.
- No explicit sharing/private field in the main editor despite the default behavior.

**Recommendation**

- Row summary: `4 × 8–10 • 1–2 RIR • 90s`.
- Tap row to edit; drag handle to reorder; overflow for duplicate/delete.
- Persistent summary: exercises, working sets, estimated time, muscle distribution.
- Sharing control near Save, default Private.

### 8.7 Exercise library

**Good**

- Search includes muscle and equipment.
- Cards expose targets, cues, template usage, alternatives, and videos.
- The data model supports reusable exercise identity.

**Problems**

- Cards are extremely tall.
- Delete is a prominent destructive icon on every card.
- No filter/sort chips for muscle, equipment, movement type, or favorites.
- Exercise names and metadata are free text, which will create inconsistent taxonomy.
- Creation is a long bottom sheet with many fields and limited progressive disclosure.
- Reference videos accept URLs but do not establish source quality.

**Recommendation**

- Compact list with name, muscle, equipment, and usage.
- Detail screen for cues/videos/alternatives.
- Controlled taxonomies with custom fallback.
- Filter sheet and favorites.
- Hide advanced metadata until after name/muscle/equipment.

### 8.8 Workout player

This is the highest-value product surface and currently the most urgent UX defect.

**Good**

- Session is snapshot-backed and resumable.
- Exercise alternatives are available.
- Reference videos remain in context.
- Playlist edits can be made mid-session.
- Cardio/rest/gym blocks have purpose-built UIs.

**Problems**

- At 390 px, the set row exceeds the viewport. Reps and completion controls are partly off-screen.
- Previous performance is not shown beside the current set.
- Rep targets are not visible in the logging table.
- The app does not suggest a load or progression.
- Blank sets can visually coexist with a primary “Complete Exercise” action.
- All set fields are large, but the horizontal table still tries to include delete.
- The progress fill uses the zero-based current block index, so block 1 can appear as 0% despite showing `1/4`.
- Rest behavior is separated into a block rather than also supporting a between-set timer.
- “End Workout” is always prominent and visually competes with completing the current exercise.
- Icon-only close, playlist, swap, complete, and delete controls lack explicit accessible labels.

**Required redesign**

- Use a responsive set-row grid: Set, Previous, Target, Actual, Complete.
- On narrow screens, combine weight/reps into one row and move delete to swipe/overflow.
- Prefill last weight/reps; show suggested next target.
- One-tap copy previous set.
- Start an exercise-specific rest timer on set completion.
- Disable/confirm completion when required sets are blank.
- Keep end-workout in an overflow or secondary footer action.
- Preserve an obvious offline save state without covering content.

### 8.9 Live workout playlist

**Good**

- Clear locked/current/upcoming distinction.
- Reordering constraints are explained.
- Adding a block mid-workout is supported.

**Problems**

- Edit, move up, move down, and delete create a dense control cluster.
- Deleting or adding blocks during a session can invalidate the user’s intended program without showing the effect.
- “Save” can be confused with saving the workout session rather than the playlist edits.

**Recommendation**

- Use drag handles for upcoming blocks.
- Put edit/delete in an overflow.
- Label Save as “Apply changes.”
- Ask whether edits apply to this session only or also update the program.

### 8.10 Nutrition

**Good**

- The visual summary is clear.
- Day history is accessible.
- Meal cards are readable.
- Delete is undoable.
- Calorie target status is visible.

**Problems**

- Meals are manually entered aggregate numbers, not foods.
- Protein, carbs, and fat use fixed display maxima (`200/300/80`) rather than user targets.
- There is no protein target in weekly targets.
- “kcal today” remains the label when a past date is selected.
- No recent foods, copy meal, favorite meal, recipe, barcode, photo, voice, or quick-add flow.
- No meal-time structure, although users commonly plan breakfast/lunch/dinner.
- No confidence/source indicator for nutrition data.

**Minimum credible upgrade**

- recents and favorites;
- reusable meals/recipes;
- user macro targets, especially protein;
- copy from another day;
- portions and units;
- barcode/data provider;
- quick-add calories/macros remains available as an escape hatch.

Do not build a giant crowd-sourced food database from scratch.

### 8.11 Profile and account

**Good**

- Identity, edit, sync, export, and logout are all present.
- The profile card is compact.
- Navigation rows are clear.

**Problems**

- Profile contains five major product areas plus account operations.
- Sync status can overlay the Account section and bottom navigation.
- “Seed Data” is exposed in development builds alongside real account actions.
- No unit settings, theme, data deletion, password management, privacy, terms, notification status summary, or connected-app management.
- Logout’s sync language is thoughtful, but recovery can become blocked when offline.

**Recommendation**

- Move Progress to primary navigation.
- Split Settings into Account, Preferences, Data & Sync, Notifications, Privacy.
- Reserve transient sync UI for a small nonblocking indicator; show detail on tap.
- Add delete account and full data export.

### 8.12 Progress

**Good**

- Uses a 7-day moving average rather than raw weight noise.
- Shows trend rate and overall delta.
- Separates tracked from hit days in adherence calculations.

**Problems**

- Range is hard-coded to three months with no selector.
- Chart has no date axis, grid, interaction, or tooltip.
- Min/max labels are placed along the bottom, where they look like dates.
- Every data point is drawn, creating a visually heavy dotted line.
- Workout count is not compared with plan or previous period.
- There is no strength progression, volume, measurement, or photo trend.
- “Weekly Adherence” is actually based on the last 14 days.
- No explanation connects trend and behavior.

**Recommendation**

- Range selector: 1M / 3M / 6M / 1Y / All.
- Interactive chart with date and value.
- Insight cards: “Weight trend −0.2 kg/week; target −0.3.”
- Training: estimated 1RM, volume, consistency, muscle balance.
- Physique: measurement trend and optional progress photos.
- Show data completeness so low-confidence insights are not overinterpreted.

### 8.13 Body measurements

**Good**

- Cadence reduces compulsive daily measuring.
- Current, previous, and delta values are visible together.
- Export is available.
- Bilateral values are supported.

**Problems**

- Fixed 15-day cadence may not fit every goal.
- “Arms” and “Biceps” are ambiguous/redundant.
- Onboarding uses metric units, measurement entry uses inches, and no unit setting is available.
- Slot timing inherits exact times and produces awkward check-in windows.
- Color-only delta meaning can imply that every decrease/increase is universally good.
- No measurement instructions, anatomical diagrams, consistency tips, or photo support.

**Recommendation**

- User-selectable cadence with a recommended default.
- Clear measurement definitions and illustrated technique.
- Units follow account preference.
- Neutral deltas until interpreted against goal.
- Optional private progress photos with explicit local/cloud controls.

### 8.14 Friends and sharing

**Good**

- Friend IDs avoid public email discovery.
- Requests are explicit.
- Templates are copied rather than linked.
- Removal uses two confirmations.

**Problems**

- New templates default to shared and legacy missing values normalize to shared.
- The screen combines ID, friends, requests, search, and template sharing in one large implementation.
- Cloud failure returns only “Unable to load friends,” with no back, retry, diagnostics, or offline cache.
- The social value proposition is limited to template copying; there is no reason to return regularly.
- Privacy status is not surfaced when creating a template.

**Recommendation**

- Private by default; explicit per-template opt-in.
- Recovery state with Back, Retry, and last-known cached list.
- Decide whether social is a real product pillar. If not, keep it lightweight and utility-based.
- If it is a pillar, focus on small private groups, encouragement, shared programs, and accountability—not a generic public feed.

### 8.15 Reminders

**Good**

- Master control plus per-type controls.
- OS permission state is visible.
- Quiet hours exist.
- In-app pending indicators still work without OS permission.

**Problems**

- Time is entered as raw `HH:mm` text.
- The long single page hides the save action.
- Permission and scheduling failures have limited guidance.
- Reminder copy is system-oriented (“master control,” “pending indicators”).
- No preview of the next scheduled notification.

**Recommendation**

- Native time pickers.
- Save per section or autosave with feedback.
- Show “Next reminder: Today at 5:00 PM.”
- Ask for notification permission in context, not only from settings.

## 9. Accessibility audit

The implementation contains 179 `Pressable` usages and only 2 explicit `accessibilityLabel` declarations, both in the generic error fallback. Text children can provide an accessible name in some cases, but icon-only controls remain a major gap.

### Contrast

Measured contrast ratios:

| Pair | Ratio | Result |
|---|---:|---|
| `textMuted #606075` on `bg #0A0A0F` | 3.22:1 | Fails normal text AA |
| `textMuted #606075` on `surface2 #1E1E28` | 2.70:1 | Fails |
| `textSecondary #A0A0B8` on `bg` | 7.73:1 | Passes |
| `tabInactive #505065` on `surface #141419` | 2.34:1 | Fails |
| `primary #00E5FF` on `bg` | 12.84:1 | Passes |

WCAG 2.2 calls for 4.5:1 for normal text and 3:1 for large text. Apple similarly recommends at least 4.5:1 for smaller text and advises against communicating state through color alone. See [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) and [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility/).

### Touch targets

Many icon controls are 34–40 px, below Apple’s general 44 × 44 pt target guidance. The small playlist arrows, template row icons, metric badges, back controls, delete icons, and chart/navigation controls need larger hit regions. Apple’s guidance is [44 × 44 pt](https://developer.apple.com/design/tips/); WCAG 2.2’s web minimum is 24 × 24 CSS px with spacing exceptions.

### Semantic and cognitive issues

- Icon-only actions lack names and hints.
- Metric state often uses only cyan/green/grey.
- Arm icons in the streak have no date labels.
- Red “Missed workout” has no neutral recovery path.
- Input errors are not consistently announced.
- Modal focus trapping/restoration is not established.
- Dynamic type is not designed; numerous fixed heights will clip larger text.
- Charts have no text alternative.
- Haptics are used, but not as a substitute for visible feedback—this should remain true.

### Accessibility definition of done

- Every interactive control has role, label, state, and hint where needed.
- All normal text passes 4.5:1.
- All touch controls have a 44 × 44 effective target.
- State never relies on color alone.
- 200% font scaling completes every core flow.
- VoiceOver/TalkBack order matches visual order.
- Charts have summaries and selectable data points.
- Reduced Motion and Increase Contrast are respected.

## 10. Visual-system audit

### Strengths

- Strong primary color.
- Consistent dark appearance.
- One type family.
- Repeated 20 px screen gutters create alignment.
- Component shapes feel friendly and modern.

### Weaknesses

- Typography is set independently in screens rather than through text styles.
- Fifteen numeric radius values are used.
- Eighteen font sizes are used.
- The spacing scale is imported by only 3 files.
- Modals use several different overlay opacity values and patterns.
- Page headers vary between 18, 28, and 30 px and between centered/left-aligned layouts.
- Cards overuse borders and nested surfaces, reducing hierarchy.
- Cyan outlines, fills, icons, and text sometimes compete on the same screen.
- Secondary/muted text is too faint.

The proposed system is defined in `03-6PAC-DESIGN-SYSTEM-SPEC.md`.

## 11. Trust, privacy, and recovery

Trust is especially important in a health product because users enter intimate data and create long histories.

### Trust-positive behavior

- Local-first saving.
- Manual sync.
- CSV export.
- Undo deletion.
- Explicit request accept/decline.
- Session snapshotting.

### Trust-negative behavior

- Firebase configuration blocks sign-up.
- Raw Firebase error reaches the user.
- Sharing defaults to on.
- Friends has a blank dead-end failure.
- Deep links are discarded because `+native-intent.tsx` always returns `/`.
- Root auth navigation unconditionally replaces the current route with the tabs route after auth resolves.
- Sync UI can block other actions.
- No visible delete-account control.
- No privacy/terms links in sign-up.
- No clear explanation of what is local, mirrored, or visible to friends.

### Required trust model

Every data class should have an explicit policy:

| Data | Default | User control |
|---|---|---|
| Daily metrics/nutrition | Private | export/delete/sync |
| Measurements/photos | Private | local/cloud choice for photos |
| Workout templates | Private | share per template or group |
| Completed workouts | Private | explicit share action |
| Friend identity | Discoverable only by ID | regenerate/block/remove |
| Diagnostics | Minimal | consent and privacy disclosure |

## 12. Responsive and technical quality

### Source measurements

- 41 TSX files across `app` and `components`
- 13,916 TSX lines
- 34 local `StyleSheet.create` blocks
- 179 Pressables
- 44 text inputs
- 14 modals
- 2 explicit accessibility labels
- only 3 files import the spacing token module

### Validation results

- Unit tests: **39/39 passing**
- Lint: **0 errors, 5 warnings**
- TypeScript: **fails with 2 errors** in `app/(tabs)/index.tsx`
- Initial Metro run: failed because nine trailing NUL bytes were appended to the Today screen; these corrupt bytes were removed during the audit.
- Real Firebase sign-up: fails because Firebase rejects the configured API key.

### Other technical UX risks

- `Dimensions.get("window").width` is captured at module load in the chart, reducing responsiveness to resize/orientation.
- The app declares portrait orientation, but web widths still vary.
- Fixed input heights and multi-column layouts are not safe under large text.
- Not-found uses an unrelated light/default style and hard-coded blue.
- Deep-link handling intentionally discards incoming paths.
- Multiple major screens exceed 600–1,100 lines, making interaction consistency hard to maintain.

## 13. Severity-ranked issue register

| ID | Severity | Area | Issue | Recommended outcome |
|---|---|---|---|---|
| UX-001 | P0 | Auth | Firebase API key rejected | Build-time validation and working production auth |
| UX-002 | P0 | Player | Set logger overflows mobile viewport | All controls fit at 320–430 px and 200% text |
| UX-003 | P0 | Privacy | Templates shared by default | Private-by-default migration |
| UX-004 | P0 | System UI | Sync surface covers content/nav | Reserved/nonblocking placement |
| UX-005 | P0 | Friends | Error state is a dead end | Back, retry, cached data, explanation |
| UX-006 | P0 | Build | TypeScript fails | Zero type errors in CI |
| UX-007 | P1 | Today | No next workout or log-meal CTA | Action-led Today |
| UX-008 | P1 | Week | Active week off-screen | Auto-center selected week |
| UX-009 | P1 | Week | Hard-coded 6-workout target | Derive from user plan |
| UX-010 | P1 | Train | No previous-set/progression context | Previous, target, suggestion per set |
| UX-011 | P1 | Nutrition | Aggregate manual entry only | Recents, reusable meals, portions, data provider |
| UX-012 | P1 | Accessibility | Missing labels/roles | Full semantic pass |
| UX-013 | P1 | Accessibility | Muted contrast fails | Semantic accessible text colors |
| UX-014 | P1 | Navigation | Deep links discarded | Auth-aware route preservation |
| UX-015 | P1 | Progress | Fixed range and misleading axes | Interactive, labeled range-aware charts |
| UX-016 | P1 | Consistency | Docs and implementation disagree | Canonical product rules |
| UX-017 | P1 | Onboarding | Data collection has no payoff | Generate/review first plan |
| UX-018 | P1 | Units | kg/cm onboarding, inches measurements | User unit preference |
| UX-019 | P1 | Sharing | Share state absent from editor | Visible private/shared control |
| UX-020 | P1 | Recovery | “Missed” has no reschedule action | Move/skip/rebalance flow |
| UX-021 | P2 | Exercise library | Tall cards and free taxonomy | Compact list, filters, controlled fields |
| UX-022 | P2 | Reminders | Raw time entry | Native picker and next-fire preview |
| UX-023 | P2 | Measurements | Rigid cadence and no technique help | Configurable cadence and guidance |
| UX-024 | P2 | Account | No delete account/privacy hub | Complete data controls |
| UX-025 | P2 | Design system | Screen-local components/styles | Shared primitives and tokens |

## 14. Product principles for the redesign

1. **Action before analytics.** Every dashboard starts with the next useful action.
2. **Log in seconds.** Recents, defaults, previous values, and one-tap completion beat repeated typing.
3. **Progress, not punishment.** Explain and recover from deviations; do not shame.
4. **Depth on demand.** Beginner-simple surface, advanced detail one layer deeper.
5. **Private by default.** Sharing is always an explicit action.
6. **Offline means trustworthy.** Every write confirms local save; sync is secondary and nonblocking.
7. **Explain recommendations.** Rules and algorithms show why a target changed.
8. **One product language.** “Plan,” “workout,” “program,” “target,” “streak,” and “adherence” each have one definition.
9. **Accessibility is a component contract.** It is not repaired screen by screen at the end.
10. **Celebrate outcomes, not data entry.** Reward workouts, trends, and sustainable consistency—not merely filling every field.

## 15. Recommended validation research

Before visual redesign is finalized, run:

- 5 beginner lifters who currently use no tracker;
- 5 intermediate lifters using Hevy/Strong/Boostcamp;
- 5 nutrition-focused users using MacroFactor/Cronometer/MyFitnessPal;
- at least 3 users who rely on screen readers, large text, or reduced motion;
- 3 users with inconsistent schedules who frequently move workouts.

Core tasks:

1. create an account and understand what happens next;
2. plan a three-day week;
3. start and log two sets;
4. swap an unavailable exercise;
5. log a repeated meal;
6. recover from a missed day;
7. explain whether progress is on track;
8. find privacy/sharing state;
9. use the app offline and interpret sync;
10. export or delete data.

Measure completion, time, error rate, confidence, perceived effort, and whether users can correctly explain the plan after the task.

