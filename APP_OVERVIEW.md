# Six-Pac Tracker — App Overview

This document describes how the app works from a planning and usage perspective — the full flow from setup to daily execution to long-term tracking.

---

## Core Philosophy

**Plan first, then execute.**

The app is built around a weekly planning cycle. Before any workout can start, the entire week must be planned out. Each day is assigned a workout or marked as a rest day. This forces intentional, structured training rather than showing up to the gym without a plan.

---

## The Full Journey (How Everything Connects)

```
Create Exercises
      ↓
Build Workout Templates (using those exercises)
      ↓
Plan the Week (assign templates to days)
      ↓
Set Weekly Targets (calories, steps, water)
      ↓
Daily: Log metrics + Execute workout + Log meals
      ↓
Every 15 days: Log body measurements
      ↓
Weekly/Monthly: Review progress & trends
```

---

## Step 1 — Onboarding

When you first create an account, the app walks through a 5-step setup:

1. **Full name**
2. **Date of birth**
3. **Biological sex**
4. **Current weight (kg)**
5. **Fitness goal** — choose one:
   - **Lean** — cut fat, stay athletic
   - **Body Recomp** — build muscle while losing fat
   - **Buffed** — max muscle and strength gains

This information personalizes the experience and gives the app context for tracking progress toward your goal.

### Authentication

The app currently supports:

- **Email + Password**
- **Google Sign-In on Android native builds**

Important implementation notes:

- Google auth is intended for a real Android build, not Expo Go
- The Android app package and Firebase Android app must match
- Firestore must exist in the Firebase project and have rules that allow authenticated users to access their own data
- The app is local-first, but cloud sync still depends on valid Firebase Auth + Firestore configuration

---

## Step 2 — Building Your Exercise Library

Before making any workouts, you build your **Exercise Library** — a personal bank of exercises you can reuse across any workout.

### What you define per exercise:

| Field | What it is |
|---|---|
| **Name** | E.g., "Barbell Bench Press" |
| **Coaching Cues** | Form notes and technique tips you want to remember |
| **Movement Type** | Compound (works multiple muscle groups) or Isolation (single muscle) |
| **Primary Muscle Group** | The main muscle being targeted |
| **Target Muscles** | All muscles engaged (e.g., chest, triceps, shoulders) |
| **Equipment** | Barbell, dumbbell, machine, bodyweight, etc. |
| **Reference Videos** | Up to 5 YouTube links for proper form demos |
| **Alternative Exercises** | Swaps you can use if the equipment isn't available |

Once an exercise is created it lives in your library forever and can be used in any workout template.

---

## Step 3 — Building Workout Templates

A **Workout Template** is a reusable workout structure. Think of it as your workout recipe — you build it once and can assign it to any day in any future week.

### Templates are made of Blocks (in order):

**Gym Block** — an exercise with sets
- Which exercise from your library
- Number of sets (e.g., 4)
- Rep range (e.g., "8–10")
- Template-level notes (e.g., "last set to failure")

**Cardio Block** — a cardio session
- Type of cardio (running, cycling, rowing)
- Duration (minutes and seconds)

**Rest Block** — a timed rest period
- Duration in seconds (e.g., 90 seconds)
- Optional label (e.g., "Rest between working sets")

You arrange blocks in the order you want to do them. They can be reordered at any time. A single workout might look like: Warmup Cardio → Exercise → Rest → Exercise → Rest → Cool Down Cardio.

### Sharing
Templates can be shared with friends. Friends can copy your template into their own library and use it as-is or modify it.

---

## Step 4 — Planning the Week

This is the central planning hub of the app. You must plan the **entire week (Monday–Sunday)** before workouts become available.

### For each of the 7 days, assign one of:
- **A workout template** — this day has a workout, select which one
- **Rest Day** — intentional recovery, no workout
- *(You can leave days Unplanned temporarily, but the week won't unlock until all 7 days are decided)*

### You can plan up to 5 weeks ahead.

### Weekly Targets (set once per week, apply to all 7 days):

| Target | Default |
|---|---|
| Daily Calories | 2400 kcal |
| Daily Steps | 8,000 steps |
| Daily Water | 2,500 ml |
| Target Weight | Optional goal weight |
| Weight Goal | Lose / Gain / Maintain |

These targets become the benchmark for your daily adherence tracking throughout the week.

---

## Step 5 — Daily Execution

Each day has two main activities: **logging health metrics** and **executing your workout**.

### Daily Metrics (logged on the Home screen):

| Metric | Unit |
|---|---|
| Weight | kg (today's weigh-in) |
| Sleep | hours |
| Steps | count |
| Water | ml (quick +250ml buttons) |
| Supplements | yes/no toggle |
| Notes | free text journal entry |

### Starting a Workout

Go to the Workouts tab → "Today's Workout" → tap Start.

This opens the **Player screen** where you execute the workout block by block:

- **Gym blocks**: For each set, enter the weight lifted and reps completed, then mark the set done. You can add extra sets if you're feeling strong, remove sets you skip, or swap to an alternative exercise mid-session.
- **Cardio blocks**: A timer runs for the defined duration. Can pause/resume.
- **Rest blocks**: Countdown timer. Skip early or wait it out.

Reference videos and coaching cues from the exercise library are available during execution. If you don't finish, the session saves automatically and you can **resume later from where you left off**.

When the workout is complete, mark it done. The session is saved to history with exact weights, reps, and timing.

---

## Step 6 — Logging Nutrition

Throughout the day, log individual meals on the **Nutrition tab**.

### What you log per meal:

| Field | Required |
|---|---|
| Meal name (e.g., "Chicken with Rice") | Yes |
| Calories | No |
| Protein (g) | No |
| Carbs (g) | No |
| Fat (g) | No |
| Notes | No |

The daily summary shows total calories and macro breakdown, with progress bars showing how close you are to your weekly targets. The app tracks whether each day hit the calorie target (within a 5% margin), which feeds into your adherence stats.

---

## Step 7 — Body Measurements (Every 15 Days)

Body measurements are logged on a **15-day schedule** — once a slot opens, you can log measurements for that period. You cannot log ahead into future slots.

### What gets measured (in inches, stored internally in cm):

- Waist
- Chest
- Shoulders
- Arms (right and left separately)
- Thighs (right and left separately)
- Biceps (right and left separately)
- Body fat % (optional)
- Notes

This 15-day cadence prevents obsessive frequent measuring while still capturing meaningful progress over time.

---

## Step 8 — Reviewing Progress

### Weekly Summary (Week screen)

After the week wraps up, the Week screen shows:
- Average weight, calories, sleep, steps, water for the week
- Workouts completed vs. planned
- Visual adherence indicators per metric

### Long-Term Progress (Progress screen)

Tracks trends over 1, 3, 6, or 12 month windows:

| Metric | How it's shown |
|---|---|
| Weight | 7-day moving average line chart |
| Weight change | Total delta over the selected period |
| Workout days | Count of completed workouts |
| Calorie adherence | % of days hitting the target (last 14 days) |
| Steps adherence | % of days hitting the target (last 14 days) |
| Water adherence | % of days hitting the target (last 14 days) |

Trend direction arrows show if metrics are heading up, down, or staying flat — and at what weekly rate.

---

## Workout Streaks

- **Current Streak**: Consecutive days with a completed workout
- **Max Streak**: Best streak ever achieved
- **30-day calendar**: Visual rolling window of active workout days

Streaks are based on completed workout sessions only — planned or rest days do not count.

---

## Reminders

Four configurable reminder types, each with a custom time:

| Reminder | Purpose |
|---|---|
| Measurements | Prompt to log body measurements |
| Weekly Plan | Remind to plan the upcoming week (defaults to Sunday) |
| Workout | Pre-workout heads-up with configurable lead time |
| Daily Logging | Prompt to log daily metrics |

Quiet hours can be set so no reminders fire during sleep.

---

## Friends

Each user gets a unique **Friend ID** (e.g., "ABC-123") — shareable without exposing email or username.

- Add friends by their ID
- Accept or decline friend requests
- See workout templates friends have shared
- Copy a friend's workout template into your own library
- Share your own templates with your friends

---

## Data & Sync

The app is **local-first** — everything saves to your device immediately and works offline. Data automatically mirrors to the cloud (Firebase) in the background. A sync indicator shows pending changes and sync status. You can also force a manual sync from the Profile screen.

### Firebase / Cloud assumptions

For the app to sync correctly, the Firebase project must have:

- Firebase Authentication enabled
- A default **Cloud Firestore** database created
- Firestore security rules that allow each authenticated user to read/write only their own `users/{uid}` data
- The app's Android Firebase configuration aligned with the Android package used in the build

If Firestore is deleted and recreated, the app can rebuild user data structure from scratch as users sign in and create new records, but the Firestore database itself must exist first.

Data can be exported as a CSV file from the Profile screen.

---

## Summary — The Weekly Rhythm

| When | What |
|---|---|
| Sunday (or before the week starts) | Plan all 7 days, set weekly targets |
| Every morning | Log weight and sleep |
| During the day | Log meals and water as you go |
| Workout day | Execute the assigned workout in the Player |
| Evening | Log steps, notes, supplements |
| Every 15 days | Log body measurements |
| End of week | Review adherence and weekly summary |
| Monthly/Quarterly | Check the Progress screen for long-term trends |
