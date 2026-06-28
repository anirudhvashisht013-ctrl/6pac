# 6Pac Product Design Audit — Index

**Audit date:** 28 June 2026  
**Product reviewed:** current Expo/React Native source in this repository  
**Viewport used for visual review:** 390 × 844 px mobile web, dark mode  
**Scope:** authentication, onboarding, daily tracking, weekly planning, training, nutrition, progress, measurements, friends, reminders, sync, export, reusable UI, accessibility, responsive behavior, and competitor patterns.

## Executive readout

6Pac is not a visually bad product. It has a recognizable dark/cyan identity, a consistent typeface, useful empty/loading states, and a real product idea: connect weekly intention with daily training, food, recovery, and physique progress.

The weak point is the experience architecture and the maturity of the UI library.

- **Visual coherence:** 7/10
- **Core-flow usability:** 4.5/10
- **Information architecture:** 4/10
- **Accessibility:** 2/10
- **Design-system maturity:** 3.5/10
- **Trust and recovery:** 3/10
- **Overall product UX:** **4.6/10**

The app often looks polished at rest but becomes fragile during real tasks. The workout player overflows a 390 px viewport, the week selector does not bring the selected/current week into view, the sync surface can cover content and navigation, the friends failure is a dead end, new workout templates default to shared, deep links are discarded, and the checked-in Firebase key currently blocks real sign-up. These are trust failures, not cosmetic preferences.

The strongest opportunity is to make 6Pac the **calm daily operating system for physique change**:

> One place that tells me what matters today, lets me log it quickly, adapts the plan without shaming me, and shows whether the whole system is working.

## Deliverables

1. [Full UI/UX audit](./01-6PAC-UI-UX-AUDIT.md)  
   Product model, information architecture, usability, accessibility, trust, responsive behavior, flow findings, severity-ranked issues, and what is already working.

2. [Competitor and user research](./02-COMPETITOR-USER-RESEARCH.md)  
   MacroFactor Nutrition and Workouts, Hevy, Strong, Fitbod, Cronometer, MyFitnessPal, Caliber, and Boostcamp; user praise/complaints; opportunity map; patterns to borrow and avoid.

3. [6Pac design-system specification](./03-6PAC-DESIGN-SYSTEM-SPEC.md)  
   Current foundations plus a proposed production token system, typography, spacing, semantic colors, component contracts, states, accessibility, motion, charts, content rules, and governance.

4. [Design-library and UX maturity assessment](./04-DESIGN-LIBRARY-AND-UX-MATURITY-ASSESSMENT.md)  
   Quantified source review, maturity scorecard, duplication and token usage, accessibility coverage, component gaps, and a migration strategy.

5. [Screen-by-screen competitive analysis](./05-SCREEN-BY-SCREEN-COMPETITIVE-ANALYSIS.md)  
   Every major 6Pac screen compared with the most relevant competitor behavior, followed by specific redesign direction and acceptance criteria.

6. [Visual reference pack](./06-6PAC-VISUAL-REFERENCE-PACK.md)  
   A Claude-friendly gallery and annotated index for 34 captured screen states. Individual PNGs live in [`docs/visual-audit/screens`](./visual-audit/screens/), with a [print-ready PDF](./visual-audit/6pac-visual-reference.pdf).

7. [Prioritized redesign roadmap](./07-PRIORITIZED-REDESIGN-ROADMAP.md)  
   P0 stabilization, P1 experience restructuring, P2 intelligence/integrations, sequencing, outcomes, instrumentation, and definition of done.

## Recommended reading order

For product direction:

1. This index
2. Competitor research
3. Full audit
4. Roadmap

For implementation or a Claude handoff:

1. Full audit
2. Design-system spec
3. Screen-by-screen analysis
4. Visual reference pack
5. Roadmap

## Highest-priority findings

| Priority | Finding | Why it matters |
|---|---|---|
| P0 | Firebase rejects the checked-in API key | Real account creation cannot complete; visual quality is irrelevant if entry is blocked. |
| P0 | Workout set table overflows at 390 px | Reps and completion controls are partially off-screen in the app’s core task. |
| P0 | Templates are shared by default | New and legacy workouts can be exposed to friends without an explicit opt-in. |
| P0 | Sync status surface overlays content/navigation | A system-status component can block the actions it is meant to protect. |
| P0 | Friends error state has no back or retry action | A network/configuration failure traps the user on a blank screen. |
| P0 | TypeScript build fails in the Today screen | Current source has two `DateLike` type errors; release readiness is compromised. |
| P1 | Today does not present the next workout or a meal-log shortcut | The app’s main screen is a metric form, not a daily action plan. |
| P1 | Week navigation hides the selected/current week | Historical chips open at the beginning and do not auto-scroll to the active week. |
| P1 | Workout logging omits previous-set context and clear targets | Users must remember progressive-overload decisions the app already has enough data to support. |
| P1 | Nutrition only logs manually entered meal totals | It cannot compete with food search, recents, barcode, recipe, photo, or voice workflows. |
| P1 | Accessibility semantics are nearly absent | The source contains 179 `Pressable` instances but only 2 explicit `accessibilityLabel` declarations. |
| P1 | Product rules and documentation disagree | The overview says the full week must be planned and streaks are workout-based; current UI allows partial plans and uses metric logging for streaks. |

## Audit method and limitations

The review combined:

- complete route and component inventory;
- source inspection of all app screens and reusable UI;
- mobile screenshots from real rendering;
- representative local-first fixture data for authenticated screens;
- real unauthenticated sign-up attempt;
- lint, TypeScript, and unit-test checks;
- contrast calculations against WCAG thresholds;
- current official competitor pages, App Store listings, and directional user feedback from public communities.

The authenticated visual pass used a temporary local audit identity because Firebase rejected the repository’s API key. The fixture was removed after capture. It did not alter production behavior or user data. Screens that depend entirely on cloud friends data were captured in their genuine failure state.

This is an expert review and desk-research study, not a substitute for moderated usability testing. The roadmap includes the user tests needed before a major redesign is finalized.
