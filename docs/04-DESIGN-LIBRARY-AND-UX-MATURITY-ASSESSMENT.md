# 6Pac Design Library and UX Maturity Assessment

## 1. Verdict

The current codebase has a **visual style**, but not yet a mature **design system**.

The distinction matters:

- A visual style makes screens look related.
- A design system makes behavior, accessibility, spacing, states, and implementation reliably consistent.

6Pac scores **3.5/10 for design-system maturity**. The app is ahead of an unstyled prototype but behind a production component library.

### Honest assessment

| Area | Score | Why |
|---|---:|---|
| Brand foundations | 6/10 | Coherent palette and type family; muted colors fail contrast. |
| Token architecture | 3/10 | Color object and small spacing scale exist; screen code mostly bypasses them. |
| Typography system | 4/10 | One family, but 18 independent sizes and no reusable text styles. |
| Layout/spacing | 3/10 | Repeated 20 px gutters help; spacing tokens are imported by only 3 files. |
| Component primitives | 2/10 | No shared Button, Text, Card, Input, Header, Sheet, or Screen. |
| Domain components | 6/10 | Exercise picker/form, streak, videos, sync, reminders, and toast have useful reuse. |
| State coverage | 5/10 | Loading, empty, undo, startup failure, and sync exist; recovery is inconsistent. |
| Accessibility | 2/10 | Semantic labels, contrast, target size, chart alternatives, and large text need systematic work. |
| Responsive behavior | 3/10 | Mobile aesthetic is consistent; workout player overflows at a normal width. |
| Documentation/governance | 1/10 | No component contract, variant catalog, visual test suite, or token enforcement. |

## 2. Quantified source review

| Measure | Current result |
|---|---:|
| TSX files reviewed | 41 |
| TSX lines | 13,916 |
| App screen/layout files | 26 |
| Local `StyleSheet.create` blocks | 34 |
| `Pressable` usages | 179 |
| `TextInput` usages | 44 |
| Modal usages | 14 |
| Explicit `accessibilityLabel` declarations | 2 |
| Files importing `constants/spacing` | 3 |
| Numeric font-size values | 18 |
| Numeric border-radius values | 15 |
| Outfit font-family declarations | 366 |

The high number of Outfit declarations is not proof of consistency; it is evidence that every local stylesheet repeats font decisions.

### Screen size concentration

Several screens are large enough that UI consistency becomes difficult:

| File | Approx. lines |
|---|---:|
| `app/player.tsx` | 1,147 |
| `app/(tabs)/week.tsx` | 1,125 |
| `app/workout-playlist.tsx` | 1,047 |
| `app/profile-friends.tsx` | 902 |
| `app/editor.tsx` | 722 |
| `app/(tabs)/profile.tsx` | 698 |
| `app/(tabs)/index.tsx` | 644 |
| `app/profile-measurements.tsx` | 602 |
| `app/(auth)/onboarding.tsx` | 536 |

Large files are not automatically bad, but here they contain domain logic, async state, navigation, validation, and extensive local style definitions in one place. That makes small visual changes risky and encourages more one-off CSS-in-JS.

## 3. Current foundation review

## 3.1 Colors

`constants/colors.ts` is the strongest foundation artifact. It defines background, surfaces, borders, brand colors, statuses, text colors, and tab colors.

### Good

- Semantic names are better than raw color names.
- Primary cyan has excellent contrast against the dark canvas.
- Success/warning/error are visually distinct.
- Subtle background variants already exist.

### Weak

- `textMuted` is 3.22:1 on the canvas and 2.70:1 on cards.
- `tabInactive` is 2.34:1 on the tab bar.
- Some screens introduce new hard-coded red, blue, yellow, black, and overlay colors.
- Opacity is concatenated to hex values in consumers, creating unverified combinations.
- There is no light/high-contrast theme.
- Color roles are not enforced, so cyan is used for border, icon, fill, text, and focus simultaneously.

## 3.2 Spacing

`constants/spacing.ts` defines 4, 8, 12, 16, 24, 32, and 40.

### Good

- 4 px base is appropriate.
- Names are simple.

### Weak

- Only 3 files import it.
- The most common screen gutter, 20 px, is absent.
- Local styles use many magic values.
- There is no layout primitive to consume spacing consistently.

## 3.3 Typography

The root loads four Outfit weights.

### Good

- One family creates brand coherence.
- Weight choice is generally sensible.

### Weak

- 18 font sizes range from 10 to 64.
- Line heights are frequently omitted.
- The same role changes size across screens.
- Page titles vary from 18 to 30.
- Back labels can be 12–13 and use failing muted contrast.
- Font declarations are repeated hundreds of times.
- Large-text behavior is not defined.

## 3.4 Radius and shape

There is no shared radius scale. Numeric radii include 2, 3, 4, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 40, 50, 99, and 999 patterns.

The product visually favors 10–16 px rounded rectangles, but the code does not describe which radius belongs to which component.

## 4. Current reusable-component inventory

## 4.1 Components worth preserving and evolving

### `FeedbackToastHost`

**Value:** supports success/error tone and undo.  
**Improve:** accessibility announcement, focus behavior, safe-area placement, queue behavior documentation, standardized action lifetime.

### `ExercisePickerModal`

**Value:** centralizes exercise search/selection.  
**Improve:** use common Sheet, Input, Filter, ListRow, EmptyState, and accessibility semantics.

### `ExerciseFormModal`

**Value:** centralizes a complex domain form.  
**Improve:** split basic/advanced sections, common form fields, sticky save, taxonomy controls, dynamic-text testing.

### `ReferenceVideosSection`

**Value:** reusable training context.  
**Improve:** standardized media row, captions/source metadata, loading/error states, privacy/network explanation.

### `SyncStatusIndicator`

**Value:** exposes local-first infrastructure.  
**Improve:** stop overlaying content; reduce normal-state visibility; move detail into a sheet.

### `PendingSurface`

**Value:** good concept for reminder/pending work.  
**Improve:** integrate into Today hierarchy and standardize snooze/dismiss actions.

### `ErrorBoundary` / `ErrorFallback` / `StartupFailureState`

**Value:** prevents silent crashes and provides startup recovery.  
**Improve:** bring into the brand system, remove unrelated hard-coded colors, map details to support actions, preserve navigation.

### `Streak`

**Value:** reusable behavior loop.  
**Improve:** redesign the concept, not just the styling. Identical arm icons without dates do not communicate a 30-day history.

## 4.2 Compatibility components

`KeyboardAwareScrollViewCompat` and platform-specific floating video players are infrastructure, not design-system components. Keep them behind stable interfaces.

## 4.3 Missing primitives

The absence of these components causes most inconsistency:

- `Screen`
- `Text`
- `AppHeader`
- `Button`
- `IconButton`
- `Card`
- `ListRow`
- `Divider`
- `Stack`
- `FormField`
- `NumericField`
- `SelectField`
- `SegmentedControl`
- `Sheet`
- `Dialog`
- `Banner`
- `EmptyState`
- `ErrorState`
- `Skeleton`
- `MetricCard`
- `ProgressBar`
- `TrendChart`

## 5. Behavioral inconsistency caused by missing primitives

### Headers

Current screens independently choose:

- left 30 px title;
- centered 18 px title;
- back text or icon only;
- close icon or back arrow;
- top padding of safe area + 12, +20, or +67 on web;
- trailing Save text, icon button, or empty spacer.

Result: screen transitions feel like moving between mini-apps.

### Buttons

Buttons vary in:

- 34–52 px height;
- 8–14 px radius;
- font size/weight;
- icon gap;
- disabled opacity;
- loading behavior;
- focus semantics;
- accessibility.

### Inputs

Inputs vary in:

- 44–52 px height;
- surface color;
- icon/prefix layout;
- unit treatment;
- error behavior;
- multiline padding;
- focus border.

### Modals

The app has 14 modal usages with multiple overlay alpha values, bottom sheets, centered dialogs, full-screen forms, and nested selectors. There is no shared dismissal, keyboard, focus, or sticky-action contract.

### Error states

Some errors use toast, some inline text, some `Alert`, some a startup screen, and Friends removes all navigation. The choice is implementation-led rather than severity-led.

## 6. Accessibility maturity

### Current state

- 2 explicit labels for 179 Pressables.
- Icon-only actions are common.
- Muted and inactive text fail contrast.
- Multiple controls are under 44 px.
- Charts have no accessible summary.
- Status often relies on green/cyan/grey.
- fixed-height controls risk clipping dynamic text.
- horizontal workout row overflow makes controls unreachable even without assistive settings.

### Why local fixes will fail

Adding labels screen by screen will not keep future components accessible. Accessibility must be encoded in Button, IconButton, Field, ListRow, Status, Modal, and Chart APIs.

Example: `IconButton` should not compile without an accessible label. A `StatusBadge` should require both icon and text. A `TrendChart` should require a summary string.

## 7. State-system maturity

| State | Current support | Gap |
|---|---|---|
| Loading | activity indicators | layout jumps; no skeletons |
| Empty first use | several good examples | copy/layout varies |
| Empty search | present in some modals | not standardized |
| Success | toast/haptic | announcement semantics |
| Undo | meals/templates | should become common shared pattern |
| Offline | sync indicator | can cover content; message hierarchy unclear |
| Recoverable error | inconsistent | retry often absent |
| Blocking error | startup state | friends/auth need equivalent recovery |
| Saving | screen-specific | no common dirty/saved model |
| Partial data | largely absent | needed for trends/recommendations |

## 8. Responsive maturity

The app is visually designed for a phone but not systematically responsive.

Evidence:

- Workout set rows exceed a 390 px viewport.
- Progress chart width is captured from `Dimensions` at module load.
- Many forms use fixed two-column widths (`47%`).
- Bottom navigation uses web-specific fixed height.
- Overlays and sync surfaces are absolutely positioned.
- Large cards force excessive scrolling.
- No screenshot test matrix exists.

Required baseline:

- 320 × 568 compact phone;
- 390 × 844 default phone;
- 430 × 932 large phone;
- 768 px tablet;
- 200% text on default phone;
- keyboard open during every form;
- offline banner visible;
- long translated strings.

## 9. Maturity model

### Current: Level 1.5 — styled product

Level definitions:

1. **Ad hoc:** independent screens, raw values.
2. **Foundations:** tokens and common primitives.
3. **System:** documented variants/states and broad adoption.
4. **Governed:** automated tests, contribution process, accessibility gates.
5. **Adaptive:** themes/platforms/experiments evolve without fragmentation.

6Pac has some Level 2 foundation work and several domain components, but most screen UI remains Level 1.

### Target after redesign: Level 3

The goal is not a huge enterprise design system. It is:

- stable foundations;
- 15–20 primitives;
- 8–10 domain components;
- all major screens migrated;
- accessibility encoded;
- screenshot tests;
- one source of truth.

## 10. Migration strategy

### Phase A — Foundations

1. Introduce semantic color, type, spacing, radius, and motion tokens.
2. Keep current `C` aliases temporarily.
3. Add a development-only warning/lint rule for raw hex in app screens.
4. Fix contrast before visual redesign.

### Phase B — High-leverage primitives

Build in this order:

1. Text
2. Button
3. IconButton
4. Screen/AppHeader
5. Card/ListRow
6. FormField/NumericField
7. Sheet/Dialog
8. Banner/Empty/Error

These remove the largest duplication first.

### Phase C — Core domain components

1. WorkoutSetRow
2. WeekRow
3. DailyCheckIn
4. MealRow
5. ProgramCard
6. TrendChart

### Phase D — Screen migration

Order by risk/value:

1. Workout player
2. Today
3. Weekly Plan
4. Workouts/editor
5. Nutrition
6. Progress
7. Profile/settings
8. Measurements
9. Friends
10. Auth/onboarding

Auth is visually simpler, but it should be migrated after primitives stabilize unless the current production failure requires immediate functional work.

### Phase E — Governance

- component examples;
- state matrix;
- accessibility tests;
- screenshot tests;
- design review checklist;
- token enforcement;
- deprecation log.

## 11. Component adoption metrics

Track:

| Metric | Current | Target |
|---|---:|---:|
| Files using spacing tokens | 3 | 100% of UI files |
| Raw font declarations in screens | 366 Outfit declarations | near zero outside Text styles |
| Explicit local button styles | many | zero for standard buttons |
| Pressables with guaranteed accessible name | unknown/low | 100% |
| Raw hex values in app screens | present | zero, except documented media edge cases |
| Unique radii | 15+ numeric values | 6 tokens |
| Screenshot-tested widths | 0 | 4 widths + large text |
| Core screens using `Screen` | 0 | 100% |

## 12. Definition of done

The design library is ready for production when:

- the workout player has no horizontal overflow;
- all core screens use shared Screen/Header/Button/Input/Card primitives;
- all text and controls meet contrast/target requirements;
- icon-only buttons cannot be created without labels;
- modals share keyboard/focus/dismissal behavior;
- dark, light, and high-contrast tokens are possible without screen edits;
- all core empty/loading/offline/error states are documented and tested;
- the app passes TypeScript, lint, unit tests, and visual regression checks;
- no screen-local style creates a new primitive;
- design and code token names match.

## 13. Bottom line

The current design library is not “bad” because it lacks polish. It is immature because the polish is manually reproduced.

That is why the app can look cohesive in screenshots and still produce:

- inaccessible muted text;
- inconsistent headers;
- too-small icons;
- overflow in the most important screen;
- overlays that cover content;
- dead-end error states;
- unsafe privacy defaults.

The next design investment should convert repeated visual decisions into enforceable component behavior. Once that is done, visual iteration becomes faster and UX quality stops depending on every screen author remembering every rule.

