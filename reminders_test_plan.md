# Reminders Test Plan

## Setup
- Login with a test user that has at least one week schedule, some logs, and measurement history.
- Open **Profile > Notifications & Reminders**.
- Verify reminder toggles and default times render.

## Permission Flows
1. Denied flow
- Deny OS notification permission.
- Confirm no repeated permission prompts appear automatically.
- Confirm settings screen shows `denied` status and `Open settings` CTA.
- Confirm in-app pending surface and tab badges still appear.

2. Granted flow
- Enable OS notifications.
- Confirm settings status is `granted`.
- Confirm scheduled local notifications exist (device/system-level verification).

## Core Reminder Scenarios
1. Body measurement cycle
- Set last measurement to 14 days ago.
- Confirm pending shows "due tomorrow".
- Confirm day-before notification is planned at preferred time.
- Confirm day-of countdown notification is planned 1 hour before preferred time.
- Complete measurement early and verify cycle shifts + notifications reschedule.
- Leave measurement overdue and confirm single pending item remains (no stacked missed items).

2. Weekly planning (Sunday)
- Keep next week unplanned.
- Move time to Sunday after configured reminder time.
- Confirm "Plan next week" appears in pending and Week tab dot turns on.
- Complete week plan and confirm pending clears immediately and tab dot updates.
- Complete late Monday and verify past-week nagging does not continue.

3. Workout reminder
- Mark today as planned workout, no completed session.
- Confirm pending appears near configured lead window.
- Confirm CTA deep-links to Workouts tab.
- Complete session and verify pending clears immediately.
- Confirm warm-up nudge appears on workout card before completion.

4. Daily logging nudge
- Leave weight/steps/sleep/water/meals incomplete.
- Move time past daily threshold.
- Confirm "Log today’s essentials" pending appears with missing list.
- Fill required fields and confirm pending disappears immediately.

## Pending UX
1. Tab badges
- Trigger pending in Today, Week, Workouts, and Profile contexts.
- Confirm dot/badge count appears on relevant tabs.
- Confirm badge clears immediately once underlying issue is resolved.

2. Pending surface
- Confirm priority order:
  - Body measurement
  - Weekly plan
  - Daily logging
  - Workout
- Validate each item has title, reason, CTA, and snooze options.
- Validate dismiss-for-cycle only appears where allowed.

3. Snooze and dismiss
- Snooze an item for 1 hour and verify it temporarily disappears.
- Dismiss a cycle item and verify it stays hidden for the configured cycle window.

## Scheduling + Safety
1. Quiet hours
- Set reminder inside quiet hours.
- Confirm scheduled notification shifts to next allowed window.

2. Cap/spam prevention
- Create multiple reminders on same day.
- Confirm one summary OS notification is used for that day.
- Confirm max notifications/day rule is respected.

3. Login/logout/reinstall
- Logout and confirm reminders are cancelled.
- Login again and confirm reminder state restores from synced data.
- Reinstall/login path: verify schedule rebuilds from cloud-synced reminder state.

## Regression Checks
- Tab navigation still works normally.
- Existing sync indicator and mirror queue behavior unchanged.
- Measurements, meals, logs, and workouts save paths still function.
