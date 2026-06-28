# 6Pac Design System Specification

## 1. Purpose

This file defines the target design system for the redesigned 6Pac app. It preserves the current brand’s strongest assets—near-black surfaces, energetic cyan, Outfit typography, and compact athletic UI—while correcting contrast, hierarchy, consistency, accessibility, and component reuse.

The system must support:

- React Native iOS and Android;
- Expo web at mobile and desktop widths;
- dark mode first;
- future light and high-contrast themes;
- dynamic text;
- VoiceOver/TalkBack;
- offline/sync states;
- dense workout logging without tiny controls;
- data visualization;
- reduced motion.

## 2. Product design principles

1. **Calm intensity** — energetic, not noisy.
2. **Action is brighter than status** — cyan is reserved for interactive priority and selected state.
3. **Numbers need context** — every metric has label, unit, period, and target/trend where relevant.
4. **One obvious next action** — only one filled primary action per surface.
5. **Depth on demand** — advanced training/nutrition detail is collapsed until requested.
6. **Private and reversible** — destructive and sharing actions are explicit.
7. **Offline confidence** — local save is immediate; sync detail is secondary.
8. **No color-only meaning** — icon, label, or shape accompanies status color.

## 3. Naming conventions

Use semantic names in components:

- `color.text.secondary`, not `gray400`;
- `space.4`, not `smallMargin`;
- `radius.card`, not `radius14`;
- `type.body.md`, not `font15`;
- `status.success`, not `green`;
- `action.primary`, not `cyan`.

Foundation tokens may be numeric/color primitives internally, but product code consumes semantic aliases.

## 4. Color

### 4.1 Current brand primitives

| Token | Current value | Use |
|---|---|---|
| `bg` | `#0A0A0F` | app canvas |
| `surface` | `#141419` | navigation/system surface |
| `surface2` | `#1E1E28` | primary card |
| `surface3` | `#272733` | raised/inner card |
| `border` | `#2A2A3A` | default border |
| `borderLight` | `#3A3A4A` | stronger border |
| `primary` | `#00E5FF` | cyan action |
| `secondary` | `#FF6B35` | orange |
| `accent` | `#7B61FF` | violet |
| `success` | `#00D68F` | success |
| `warning` | `#FFAA00` | warning |
| `error` | `#FF4757` | error/destructive |
| `text` | `#FFFFFF` | primary text |
| `textSecondary` | `#A0A0B8` | secondary text |
| `textMuted` | `#606075` | current muted text; fails contrast |
| `tabInactive` | `#505065` | current inactive nav; fails contrast |

### 4.2 Required dark semantic palette

Keep most brand primitives. Replace inaccessible muted states.

```ts
export const color = {
  canvas: "#0A0A0F",
  surface: {
    base: "#141419",
    raised: "#1E1E28",
    strong: "#272733",
    overlay: "rgba(10,10,15,0.76)",
  },
  border: {
    subtle: "#2A2A3A",
    default: "#3A3A4A",
    strong: "#505065",
    focus: "#00E5FF",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#B4B4C8",
    muted: "#8C8CA3",
    disabled: "#747489",
    inverse: "#0A0A0F",
    link: "#36EAFF",
  },
  action: {
    primary: "#00E5FF",
    primaryPressed: "#00C9DF",
    primarySubtle: "rgba(0,229,255,0.12)",
    secondary: "#7B61FF",
  },
  status: {
    success: "#00D68F",
    warning: "#FFB020",
    danger: "#FF5A68",
    info: "#56A8FF",
  },
} as const;
```

`#8C8CA3` on `#1E1E28` is approximately 5.03:1 and is suitable for normal secondary/muted text. Do not reduce opacity on text tokens; use a dedicated token with verified contrast.

### 4.3 Color roles

- **Cyan:** primary action, current selection, focus, active progress.
- **Orange:** nutrition/carbs or secondary data series; not a second primary action.
- **Violet:** recovery/optional data series.
- **Green:** completed/healthy system state.
- **Amber:** attention, pending, near-limit.
- **Red:** failed/destructive/unsafe only.
- **Grey:** neutral/inactive, never “failed.”

### 4.4 Status combinations

Every status includes color + icon + text:

| Status | Icon | Copy example |
|---|---|---|
| Complete | check circle | “Workout complete” |
| Pending | clock | “2 items left today” |
| Needs attention | warning triangle | “Sync needs attention” |
| Failed | error circle | “Couldn’t sync” |
| Offline saved | cloud off + check | “Saved on this device” |
| Private | lock | “Private” |
| Shared | people | “Shared with 3 friends” |

## 5. Typography

### 5.1 Family

Use Outfit:

- `Outfit_400Regular`
- `Outfit_500Medium`
- `Outfit_600SemiBold`
- `Outfit_700Bold`

Do not use platform `fontWeight` with Outfit unless verified on every platform. Use the registered family.

### 5.2 Type scale

| Token | Size / line | Weight | Use |
|---|---:|---|---|
| `display.lg` | 32 / 38 | 700 | rare hero number/title |
| `heading.page` | 28 / 34 | 700 | top-level screen title |
| `heading.section` | 18 / 24 | 600 | major section |
| `heading.card` | 16 / 22 | 600/700 | card title |
| `body.lg` | 16 / 24 | 400/500 | prominent body |
| `body.md` | 15 / 22 | 400 | default body/input |
| `body.sm` | 14 / 20 | 400/500 | supporting copy |
| `label.md` | 14 / 18 | 600 | button/control label |
| `label.sm` | 12 / 16 | 500/600 | metadata/pill |
| `caption` | 12 / 16 | 400 | secondary note |
| `metric.lg` | 32 / 36 | 700 | key metric |
| `metric.md` | 24 / 30 | 700 | card metric |
| `metric.sm` | 18 / 24 | 700 | compact metric |

Minimum default readable text is 12 px with 16 px line height. Avoid 10–11 px except nonessential chart annotation that also has an accessible alternative.

### 5.3 Number formatting

- Use tabular numerals where available.
- Always pair value and unit: `78.2 kg`.
- Use locale formatting: `8,450 steps`.
- Avoid excessive precision.
- Delta includes period: `−0.2 kg/week`.
- Target includes relationship: `1,980 of 2,200 kcal`.
- Percentages state denominator/context: `6 of 8 tracked days`.

## 6. Spacing

Use a 4 px base:

```ts
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;
```

Rules:

- Phone screen gutter: `space.5` (20).
- Compact component internal gap: 8.
- Standard card padding: 16.
- Large card/hero padding: 20.
- Section gap: 24–32.
- Form field gap: 16.
- Label-to-input gap: 8.
- No one-off spacing unless required by safe area or platform behavior.

## 7. Shape

```ts
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
```

Role mapping:

- input/button: 12;
- card: 16;
- compact chip: 999;
- modal sheet top corners: 20;
- icon container: 10–12.

Avoid 14 px as a screen-specific default. Migrate cards to 16 and compact rows to 12.

## 8. Borders, elevation, and focus

- Default card: 1 px `border.subtle`.
- Interactive card: 1 px default; selected uses `border.focus`.
- Avoid border + heavy shadow + colored background together.
- Android elevation and iOS shadow are reserved for overlays/floating surfaces.
- Web/native keyboard focus gets a 2 px cyan ring with 2 px offset.
- Destructive buttons use red border/subtle fill; primary destructive confirmation may use solid red.

## 9. Layout

### 9.1 Screen scaffold

Every screen uses `Screen`:

```ts
<Screen
  scroll
  title="Nutrition"
  leading={<BackButton />}
  trailing={<IconButton icon="add" label="Add meal" />}
  bottomInset="tabs"
>
  ...
</Screen>
```

Responsibilities:

- safe-area padding;
- consistent 20 px gutters;
- standard page title;
- keyboard avoidance;
- scroll indicator policy;
- tab-bar/footer inset;
- max content width on web;
- background;
- error boundary context.

### 9.2 Responsive breakpoints

| Width | Behavior |
|---|---|
| 320–374 | compact phone; single-column forms; no horizontal table overflow |
| 375–599 | default phone |
| 600–899 | tablet; optional two-column dashboard |
| 900+ | centered max-width shell; side rail optional |

Core flows must work at 320 px and 200% text before tablet enhancements.

### 9.3 Bottom navigation

- Height follows platform safe area.
- Icon effective target: 48 × 48 minimum.
- Active state: cyan icon + label + optional subtle indicator.
- Inactive label must meet contrast.
- Badge must not cover icon or remove accessible name.
- No global overlay may sit above nav without reserving space.

## 10. Interaction states

Every interactive component supports:

- default;
- pressed;
- focused;
- selected;
- disabled;
- loading;
- error if applicable.

Pressed state changes fill/border and may use light haptic. Do not use opacity alone when it makes text fail contrast.

## 11. Core components

## 11.1 Button

Variants:

- `primary` — one per screen/sheet;
- `secondary` — outlined/subtle;
- `ghost` — navigation/low emphasis;
- `danger` — destructive;
- `link` — inline.

Sizes:

| Size | Height | Padding | Label |
|---|---:|---:|---|
| small | 40 | 12 horizontal | label.sm |
| medium | 48 | 16 | label.md |
| large | 52 | 20 | label.md |

All have 44 px minimum effective target.

## 11.2 IconButton

Required props:

```ts
type IconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: "ghost" | "subtle" | "solid" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onPress: () => void;
};
```

Visible icon may be 16–22 px; hit target is 44–48 px.

## 11.3 AppHeader

Variants:

- page title left;
- detail title centered with back;
- full-screen task with close, title, and overflow.

Do not independently recreate headers inside screens.

## 11.4 Card

Variants:

- static;
- interactive;
- selected;
- status;
- danger.

Default card uses raised surface, 16 radius, 16 padding, 1 px subtle border.

## 11.5 FormField

Includes:

- visible label;
- optional helper;
- input/select;
- unit/prefix/suffix;
- error;
- required/optional state;
- accessibility description.

Inputs:

- 48 px minimum height;
- 15–16 px text;
- clear focus;
- never rely on placeholder as label;
- numeric limits shown before an error.

## 11.6 MetricCard

Required information:

- label;
- value and unit;
- relationship to target or change;
- period;
- action if editable.

Compact metric cards should not exceed two hierarchy levels.

## 11.7 Progress and status

Components:

- `ProgressBar`
- `GoalRing` only when a ring improves comprehension
- `StatusBadge`
- `CompletionChecklist`
- `DataConfidence`

Never use an unlabeled colored icon as a metric legend.

## 11.8 SegmentedControl

Use for 2–4 mutually exclusive options:

- range selectors;
- plan mode;
- weight goal;
- movement type.

Every segment has 44 px effective height and selected semantics.

## 11.9 Sheet and Dialog

Use sheet for:

- add/edit forms;
- day details;
- filters;
- exercise selection.

Use alert dialog for:

- irreversible confirmation;
- loss of unsaved changes;
- privacy/share change.

All sheets:

- visible title;
- close button with label;
- keyboard-safe content;
- sticky primary action when long;
- focus trap/restore on web;
- swipe-down only as an additional dismissal method.

## 11.10 Toast and Banner

Toast:

- confirmation or reversible action;
- never the only place for a critical failure;
- Undo stays long enough and is accessible.

Banner:

- persistent issue that affects current task;
- placed in layout, not over content;
- one primary recovery action;
- dismiss only when safe.

Sync should use:

- small icon in header for normal state;
- in-layout banner for attention;
- detail sheet for queue/debug information.

## 11.11 Empty, loading, and error states

Every data surface defines:

| State | Required content |
|---|---|
| First use | value statement + primary CTA |
| Empty after filters | explain filter + clear action |
| Loading | stable skeleton matching layout |
| Offline with cache | cached content + timestamp |
| Offline no cache | explanation + retry/back |
| Error recoverable | plain language + retry |
| Error blocking | back/home + support/details |

No full-screen state may remove all navigation.

## 12. Domain components

## 12.1 TodayActionCard

Priority order:

1. active workout;
2. scheduled workout;
3. overdue plan action;
4. rest/recovery;
5. weekly review.

Props include action, reason, estimated time, and secondary option.

## 12.2 DailyCheckIn

Five labeled compact items:

- weight;
- sleep;
- steps;
- water;
- supplements.

Tap opens a bottom sheet. Missing, logged, and target-met are separate states.

## 12.3 WeekRow

Content:

- weekday/date;
- planned workout/rest;
- completion state;
- optional one-line adherence;
- overflow.

Target height: 68–84 px, not a full card per day.

## 12.4 WorkoutProgramCard

Content:

- title;
- muscle/focus;
- days/week;
- estimated duration;
- current week/progress;
- next action.

## 12.5 WorkoutSetRow

Wide/default:

| Set | Previous | Target | Actual | Complete |

Compact:

- first line: set, previous, target;
- second line: weight, reps, complete;
- delete/duplicate in overflow.

Requirements:

- no horizontal overflow at 320 px;
- previous value one-tap copy;
- numeric keyboard;
- validation;
- set type disclosed from overflow;
- completion triggers rest timer when configured.

## 12.6 MealRow

Content:

- meal/food name;
- portion;
- calories;
- protein;
- time/meal group;
- source/confidence if applicable;
- overflow for edit/copy/delete.

## 12.7 TrendChart

Required:

- title and period;
- unit;
- accessible text summary;
- meaningful y scale;
- date x axis;
- selected point tooltip;
- target/range where relevant;
- data completeness indicator.

Do not draw a dot for every point when density makes the line noisy.

## 13. Workout-specific interaction rules

- Starting an unscheduled workout is allowed and clearly labeled.
- Completing a blank required set asks for confirmation or is disabled.
- Exercise swap defaults to this session; user can update the program.
- Reordering current/completed blocks is disallowed and explained.
- Ending a workout asks whether to save as incomplete or discard only when necessary.
- Every set saves locally immediately.
- A visible but nonblocking “Saved on device” state appears during offline use.
- The timer must survive backgrounding.

## 14. Nutrition-specific rules

- “Meal” is a container; “food” is an item.
- Quick-add macros remains available but is identified as an estimate/manual entry.
- Search prioritizes recent/favorite and verified results.
- Photo/voice results are suggestions requiring review.
- Copy from yesterday is a first-class action.
- Protein target is visible if physique/strength is the goal.
- Red is not used merely because calories are over target.
- Daily flexibility can coexist with a weekly budget.

## 15. Content style

Voice:

- concise;
- direct;
- nonjudgmental;
- evidence-aware;
- encouraging without hype.

Replace:

- “Missed workout” → “Not completed” with Move / Skip / Do now
- “Off target” → “220 kcal below today’s target”
- “Buffed Body” → “Build muscle”
- “Master control” → “Reminders”
- “Unable to load friends” → “Friends couldn’t load. Your workouts are safe.”

Use sentence case. Avoid implementation terms such as “template,” “runtime,” “projection,” “pending indicators,” or “mirror.”

## 16. Motion and haptics

Durations:

- micro feedback: 100–150 ms;
- sheet/dialog: 200–250 ms;
- navigation: platform default;
- progress change: 250–400 ms, never essential.

Rules:

- Respect Reduce Motion.
- No looping decorative animation in core flows.
- Haptic light: set complete/toggle.
- Haptic medium: workout complete or meaningful commit.
- Haptic warning: destructive confirmation.
- Always pair haptic with visible state.

## 17. Accessibility contract

Every component PR must verify:

- role;
- accessible name;
- state/value;
- hint when outcome is not obvious;
- target size;
- contrast;
- focus order;
- large-text behavior;
- color-independent status;
- reduced-motion behavior.

Examples:

```tsx
<IconButton
  icon="trash-outline"
  accessibilityLabel="Delete salmon and potatoes"
  accessibilityHint="Removes this meal. You can undo for 10 seconds."
  variant="danger"
  onPress={onDelete}
/>
```

```tsx
<Pressable
  accessibilityRole="checkbox"
  accessibilityState={{ checked: set.completed }}
  accessibilityLabel={`Set ${index + 1}, ${weight} kilograms for ${reps} reps`}
/>
```

## 18. Theme and units

The token model must support:

- dark;
- light;
- dark high contrast;
- light high contrast.

User preferences:

- metric / imperial;
- week starts Monday/Sunday;
- 12/24-hour time;
- reduced motion follows OS;
- automatic/manual theme.

All stored canonical units may remain metric, but every displayed/entered value follows preference.

## 19. Design-system package structure

Recommended:

```text
ui/
  foundations/
    color.ts
    typography.ts
    spacing.ts
    radius.ts
    motion.ts
  primitives/
    Text.tsx
    Button.tsx
    IconButton.tsx
    Card.tsx
    Divider.tsx
    Stack.tsx
  forms/
    FormField.tsx
    NumericField.tsx
    SelectField.tsx
    SegmentedControl.tsx
  feedback/
    Banner.tsx
    Toast.tsx
    EmptyState.tsx
    ErrorState.tsx
    Skeleton.tsx
  navigation/
    Screen.tsx
    AppHeader.tsx
    TabBar.tsx
  data/
    MetricCard.tsx
    TrendChart.tsx
    ProgressBar.tsx
  domain/
    DailyCheckIn.tsx
    WeekRow.tsx
    WorkoutSetRow.tsx
    ProgramCard.tsx
    MealRow.tsx
```

No domain screen defines a new button, input, modal shell, page header, or card primitive locally.

## 20. Governance and quality gates

For every shared component:

- documented props and variants;
- visual examples for all states;
- accessibility behavior;
- unit tests for interaction;
- screenshot tests at 320, 390, and 768 px;
- dark/light/high-contrast examples;
- no raw hex or magic spacing in consumer code;
- deprecation path for changed tokens.

Design review checklist:

1. Is there one primary action?
2. Can a user understand status without color?
3. Does it fit 320 px and large text?
4. Is failure recoverable?
5. Is sharing/private state explicit?
6. Are units and time periods clear?
7. Does this reuse a system component?
8. Is the recommendation explainable?

