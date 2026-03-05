# Reminder Opportunities

Additional reminder/pending opportunities discovered from current screens and data models.

| Opportunity | Trigger Condition | Suggested Timing | Local vs Push | UX Surface | Dependencies |
|---|---|---|---|---|---|
| Streak protection nudge | Current streak at risk (no essentials logged by evening) | 7:30 PM local | Local now, Push later for high-streak users | OS + in-app pending on Today tab | `logsRepo`, `lib/streak.ts`, streak counters in profile |
| Water target behind pace | Water intake < 50% target by 6 PM | 6:00 PM local | Local | In-app pending + optional OS | Today log + weekly target water |
| Sleep consistency warning | Sleep hours missed target for 3+ consecutive days | 8:00 PM local summary | Push (best from server trend eval), local fallback | In-app weekly card + optional OS | Daily logs history + target policy |
| Planned workout not completed | Planned workout day ended without completed session | 9:00 PM local | Local now, Push later | In-app pending + red dot on Workouts tab | Week schedule + sessions completion |
| Nutrition deficit/end-of-day check | Calories/macros far below target by 9 PM | 9:00 PM local | Local | Nutrition tab badge + in-app pending | Meals + manual calories + weekly target |
| Supplements missed | `supplementsTaken` is null/false near end of day | 8:30 PM local | Local | In-app Today reminder | Today log field `supplementsTaken` |
| Weekly check-in summary prompt | Week ends and user has enough data for summary | Sunday 8:30 PM | Push (better for re-engagement), local fallback | OS + deep link to Week tab insights | Logs/meals/sessions aggregation |
| Measurement photo progress prompt | 30 days since last progress photo (future feature) | Monthly, chosen time | Push preferred (cross-device), local fallback | Profile pending + optional OS | Requires photo metadata storage |
| Inactive template cleanup | Workout template unused for 30+ days | Weekly Monday 10 AM | Push optional, local fine | In-app card in Workouts | Template usage stats from sessions |
| Sync-risk warning before logout | User has pending mirror queue and tries logout offline | Immediate action-time reminder | In-app only | Existing profile logout modal + pending banner | `useMirrorSyncState`, network status |

## Notes
- Short-horizon compliance reminders (same-day actions) are ideal for local notifications + in-app pending.
- Re-engagement reminders (weekly/monthly trend-based prompts) are better as push once backend segmentation exists.
- Any push opportunities should still have an in-app pending fallback for users without notification permissions.
