# IMMEDIATE ACTION ITEMS - Next 3 Variables Hours

Based on the code review, here's exactly what needs to be done to complete the system.

---

## 🔴 CRITICAL: Enable Firestore Offline Persistence (10 min)

### Why This Matters
Progress & measurements screens use `daysRepo` which reads directly from Firestore. Without offline persistence, these break when offline.

### What to Change

**File**: `lib/firebase.ts`

Add these imports at the top:
```typescript
import { enableIndexedDbPersistence, disableNetwork, enableNetwork } from "firebase/firestore";
import { subscribeNetworkStatus } from "@/lib/network";
```

Add this function after `export const db` line:
```typescript
export async function initializeFirestoreOffline() {
  try {
    await enableIndexedDbPersistence(db);
    console.log("✅ Firestore offline persistence enabled");
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.warn("⚠️ Multiple tabs open, persistence not available");
    } else if (err.code === 'unimplemented') {
      console.warn("⚠️ Browser doesn't support offline persistence");
    } else {
      console.error("Persistence error:", err);
    }
  }

  // Update Firestore network based on real connectivity
  const listener = subscribeNetworkStatus(async (state) => {
    const isOnline = state.isOnline;
    try {
      if (isOnline) {
        console.log("🟢 Firestore: enabling network");
        await enableNetwork(db);
      } else {
        console.log("🔴 Firestore: disabling network");
        await disableNetwork(db);
      }
    } catch (error) {
      console.error("Network state update error:", error);
    }
  });

  return listener;
}
```

### Update App Initialization

**File**: `app/_layout.tsx`

Add import:
```typescript
import { initializeFirestoreOffline } from "@/lib/firebase";
```

In `RootLayoutNav()` function, update the `useEffect`:
```typescript
useEffect(() => {
  const unsubscribe = initializeFirestoreOffline();
  
  return () => {
    unsubscribe?.();
  };
}, []);
```

### Verify It Works
1. Open Progress screen (should load)
2. Toggle airplane mode
3. Progress screen should still show cached data ✅
4. Toggle back online
5. Should auto-sync any cloud changes ✅

---

## 🟠 HIGH PRIORITY: Create Migration Script (2 hours)

### Why This Matters
Existing users' data is stuck in local AsyncStorage. Won't sync to cloud until they make a new edit.

### What to Create

**File**: `lib/dev/migrate.ts` (NEW)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cloudMirrorRepo } from '@/lib/repos/cloudMirrorRepo';
import { localCacheRepo } from '@/lib/storage';

type MigrationResult = {
  timestamp: string;
  uid: string;
  logsMigrated: number;
  mealsMigrated: number;
  sessionsMigrated: number;
  templatesMigrated: number;
  targetsMigrated: number;
  schedulesMigrated: number;
  measurementsMigrated: number;
  total: number;
  status: 'success' | 'partial' | 'error';
  error?: string;
};

const MIGRATION_KEY = (uid: string) => `@6pac:migrated_at:${uid}`;

export async function hasBeenMigrated(uid: string): Promise<boolean> {
  const val = await AsyncStorage.getItem(MIGRATION_KEY(uid));
  return val != null;
}

export async function migrateAllDataToCloud(uid: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    timestamp: new Date().toISOString(),
    uid,
    logsMigrated: 0,
    mealsMigrated: 0,
    sessionsMigrated: 0,
    templatesMigrated: 0,
    targetsMigrated: 0,
    schedulesMigrated: 0,
    measurementsMigrated: 0,
    total: 0,
    status: 'success',
  };

  try {
    // Get all local data
    const snapshot = await localCacheRepo.getSnapshot(uid);

    // Migrate logs
    for (const log of snapshot.logs) {
      try {
        await cloudMirrorRepo.upsertLog(uid, log);
        result.logsMigrated++;
      } catch (e) {
        console.error(`Failed to migrate log ${log.date}:`, e);
      }
    }

    // Migrate meals
    for (const meal of snapshot.meals) {
      try {
        await cloudMirrorRepo.upsertMeal(uid, meal);
        result.mealsMigrated++;
      } catch (e) {
        console.error(`Failed to migrate meal ${meal.id}:`, e);
      }
    }

    // Migrate sessions
    for (const session of snapshot.sessions) {
      try {
        await cloudMirrorRepo.upsertSession(uid, session);
        result.sessionsMigrated++;
      } catch (e) {
        console.error(`Failed to migrate session ${session.id}:`, e);
      }
    }

    // Migrate templates
    for (const template of snapshot.templates) {
      try {
        await cloudMirrorRepo.upsertTemplate(uid, template);
        result.templatesMigrated++;
      } catch (e) {
        console.error(`Failed to migrate template ${template.id}:`, e);
      }
    }

    // Migrate targets
    for (const target of snapshot.targets) {
      try {
        await cloudMirrorRepo.upsertTarget(uid, target);
        result.targetsMigrated++;
      } catch (e) {
        console.error(`Failed to migrate target ${target.weekStartDate}:`, e);
      }
    }

    // Migrate schedules
    for (const schedule of snapshot.schedules) {
      try {
        await cloudMirrorRepo.upsertSchedule(uid, schedule);
        result.schedulesMigrated++;
      } catch (e) {
        console.error(`Failed to migrate schedule ${schedule.weekStartDate}:`, e);
      }
    }

    // Migrate measurements
    for (const measurement of snapshot.measurements) {
      try {
        await cloudMirrorRepo.upsertMeasurement(uid, measurement);
        result.measurementsMigrated++;
      } catch (e) {
        console.error(`Failed to migrate measurement ${measurement.date}:`, e);
      }
    }

    // Calculate totals
    result.total =
      result.logsMigrated +
      result.mealsMigrated +
      result.sessionsMigrated +
      result.templatesMigrated +
      result.targetsMigrated +
      result.schedulesMigrated +
      result.measurementsMigrated;

    // Mark as migrated
    await AsyncStorage.setItem(MIGRATION_KEY(uid), result.timestamp);

    console.log('✅ Migration complete:', result);
    return result;
  } catch (error) {
    result.status = 'error';
    result.error = String(error);
    console.error('❌ Migration failed:', error);
    return result;
  }
}

export async function getMigrationStatus(uid: string): Promise<{
  migrated: boolean;
  migratedAt: string | null;
}> {
  const migratedAt = await AsyncStorage.getItem(MIGRATION_KEY(uid));
  return {
    migrated: migratedAt != null,
    migratedAt,
  };
}
```

### Integrate into Onboarding

**File**: `app/(auth)/onboarding.tsx`

At the end of onboarding, after user is set up:

```typescript
import { migrateAllDataToCloud } from "@/lib/dev/migrate";

// ... in your onboarding complete handler ...

const onComplete = async () => {
  // ... existing code ...
  
  if (user?.id) {
    // Migrate all existing AsyncStorage data to cloud
    console.log("🔄 Migrating existing data to cloud...");
    const result = await migrateAllDataToCloud(user.id);
    console.log("✅ Migration result:", result);
  }
  
  // ... continue with existing navigation ...
};
```

### Alternative: Add to Settings

**File**: `app/(tabs)/profile.tsx`

Add button to settings:

```typescript
const [migrating, setMigrating] = useState(false);

const handleMigrate = async () => {
  if (!user?.id) return;
  setMigrating(true);
  try {
    const result = await migrateAllDataToCloud(user.id);
    Alert.alert(
      'Migration Complete',
      `${result.total} items uploaded to cloud`,
      [{ text: 'OK' }]
    );
  } catch (error) {
    Alert.alert('Migration Failed', String(error));
  } finally {
    setMigrating(false);
  }
};

// In settings section:
<Pressable onPress={handleMigrate} disabled={migrating}>
  <Text>{migrating ? 'Migrating...' : 'Backup Data to Cloud'}</Text>
</Pressable>
```

---

## 🟡 MEDIUM PRIORITY: Add Data Export (1 hour)

### Why This Matters
Users should be able to download their data as backup and for portability.

### What to Create

**File**: `lib/export.ts` (NEW)

```typescript
import { localCacheRepo } from "@/lib/storage";
import type { LocalDataSnapshot } from "@/lib/storage";

export async function exportAsJSON(uid: string): Promise<string> {
  const data = await localCacheRepo.getSnapshot(uid);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      userId: uid,
      ...data,
    },
    null,
    2
  );
}

export async function exportAsCSV(uid: string): Promise<string> {
  const data = await localCacheRepo.getSnapshot(uid);
  const lines: string[] = [];

  // Daily logs CSV
  lines.push("=== DAILY LOGS ===");
  lines.push("date,weight_kg,sleep_hours,water_ml,steps,notes");
  for (const log of data.logs) {
    lines.push(
      `"${log.date}","${log.weightKg ?? ''}","${log.sleepHours ?? ''}","${log.waterMl ?? ''}","${log.steps ?? ''}","${(log.notes || '').replace(/"/g, '""')}"`
    );
  }

  // Meals CSV
  lines.push("");
  lines.push("=== MEALS ===");
  lines.push("date,meal_name,calories,protein_g,carbs_g,fat_g,notes");
  for (const meal of data.meals) {
    lines.push(
      `"${meal.date}","${meal.mealName}","${meal.calories ?? ''}","${meal.proteinG ?? ''}","${meal.carbsG ?? ''}","${meal.fatG ?? ''}","${(meal.notes || '').replace(/"/g, '""')}"`
    );
  }

  // Workouts CSV
  lines.push("");
  lines.push("=== WORKOUTS ===");
  lines.push("date,workout_name,duration_min,completed");
  for (const session of data.sessions) {
    lines.push(
      `"${session.date}","${session.workoutNameSnapshot}","${session.durationMin ?? ''}","${session.completed}"`
    );
  }

  // Measurements CSV
  lines.push("");
  lines.push("=== BODY MEASUREMENTS ===");
  lines.push("date,waist_cm,chest_cm,shoulders_cm,arms_r_cm,arms_l_cm,thigh_r_cm,thigh_l_cm,biceps_r_cm,biceps_l_cm,body_fat_percent");
  for (const m of data.measurements) {
    lines.push(
      `"${m.date}","${m.waist ?? ''}","${m.chest ?? ''}","${m.shoulders ?? ''}","${m.armsR ?? ''}","${m.armsL ?? ''}","${m.thighR ?? ''}","${m.thighL ?? ''}","${m.bicepsR ?? ''}","${m.bicepsL ?? ''}","${m.bodyFatPercent ?? ''}"`
    );
  }

  return lines.join("\n");
}

export async function shareAsJSON(uid: string): Promise<void> {
  const json = await exportAsJSON(uid);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `6pac-backup-${uid}-${timestamp}.json`;

  // Share using native share (iOS/Android)
  if (typeof window !== 'undefined' && 'share' in navigator) {
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    await (navigator as any).share({
      files: [file],
      title: '6Pac Data Export',
      text: 'Your fitness data backup',
    });
  }
}

export async function downloadAsJSON(uid: string): Promise<void> {
  const json = await exportAsJSON(uid);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `6pac-backup-${uid}-${timestamp}.json`;

  // Browser download
  const element = document.createElement('a');
  element.setAttribute('href', `data:application/json;charset=utf-8,${encodeURIComponent(json)}`);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
```

### Add to Profile Screen

**File**: `app/(tabs)/profile.tsx`

```typescript
import { exportAsJSON, exportAsCSV, downloadAsJSON } from "@/lib/export";
import * as Sharing from "expo-sharing";

const handleExportJSON = async () => {
  if (!user?.id) return;
  try {
    const json = await exportAsJSON(user.id);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `6pac-${timestamp}.json`;
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync('', {
        mimeType: 'application/json',
        dialogTitle: filename,
      });
    }
  } catch (error) {
    Alert.alert('Export Failed', String(error));
  }
};

const handleExportCSV = async () => {
  if (!user?.id) return;
  try {
    const csv = await exportAsCSV(user.id);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `6pac-${timestamp}.csv`;
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync('', {
        mimeType: 'text/csv',
        dialogTitle: filename,
      });
    }
  } catch (error) {
    Alert.alert('Export Failed', String(error));
  }
};

// Add to settings section:
<Section title="Data & Privacy">
  <SettingsButton 
    icon="document-text-outline" 
    label="Export as JSON" 
    onPress={handleExportJSON}
  />
  <SettingsButton 
    icon="table-outline" 
    label="Export as CSV" 
    onPress={handleExportCSV}
  />
</Section>
```

---

## 🟢 LOW PRIORITY: Setup Reconciliation on App Start (5 min)

### Why This Matters
When app opens, should pull latest cloud data to ensure everything is in sync.

### What to Change

**File**: `context/AuthContext.tsx`

Add import:
```typescript
import { syncNow } from "@/lib/sync/syncNow";
```

In `AuthProvider`'s `useEffect` after user logs in:

```typescript
useEffect(() => {
  if (!user?.id) return;
  
  // On login, start by syncing with cloud
  void syncNow(user.id).catch((err) => {
    console.warn("Initial sync failed:", err);
    // Don't block app startup on sync failure
  });
}, [user?.id]);
```

---

## Testing Checklist

After implementing all changes, verify:

### Firestore Persistence
- [ ] Open app
- [ ] Go to Progress screen (daysRepo)
- [ ] Toggle airplane mode
- [ ] Progress screen still shows cached data
- [ ] Metrics visible offline
- [ ] Toggle back online
- [ ] New data syncs automatically

### Migration
- [ ] Create new test user
- [ ] Add some meals, workouts, logs
- [ ] Trigger migration
- [ ] Check Firestore console: data appears in cloud
- [ ] Cloud counts match local counts

### Export
- [ ] Add data in app
- [ ] Export as JSON
- [ ] File downloads with all data
- [ ] Export as CSV
- [ ] Open CSV in spreadsheet
- [ ] All columns present

### Offline Sync
- [ ] Go offline
- [ ] Add meal
- [ ] See "X pending sync" message
- [ ] Come online
- [ ] See sync animation
- [ ] Meal appears in Firestore
- [ ] Can view from other device

---

## Priority Matrix

```
URGENT (Do First):
├─ [1/10] Firestore offline persistence
└─ [2/10] Add app startup sync

HIGH (This Week):
├─ [3/10] Migration script
├─ [4/10] Integrate into onboarding
└─ [5/10] Test with real user data

MEDIUM (Next Week):
├─ [6/10] Data export feature
├─ [7/10] Add to settings UI
└─ [8/10] Test export/import

LOW (Nice to Have):
├─ [9/10] Analytics events
└─ [10/10] Performance optimization
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/firestore-persistence

# 1. Enable persistence
# Edit: lib/firebase.ts, app/_layout.tsx
git add lib/firebase.ts app/_layout.tsx
git commit -m "feat: enable Firestore offline persistence"

# 2. Migration script
# New: lib/dev/migrate.ts
git add lib/dev/migrate.ts
git commit -m "feat: add data migration to cloud script"

# 3. Data export
# New: lib/export.ts
git add lib/export.ts
git commit -m "feat: add data export functionality"

# 4. App startup sync
# Edit: context/AuthContext.tsx
git add context/AuthContext.tsx
git commit -m "feat: sync with cloud on app startup"

# Push and create PR
git push -u origin feat/firestore-persistence
```

---

## Time Estimate Summary

| Task | Time | Done? |
|------|------|-------|
| Firestore persistence | 10 min | ❌ |
| App startup sync | 5 min | ❌ |
| Migration script | 1 hour | ❌ |
| Data export | 1 hour | ❌ |
| Testing | 30 min | ❌ |
| **TOTAL** | **2.75 hours** | - |

You can have everything done **by end of day** if you focus!

---

## Final Note

Your implementation is already **production-grade**. These are the last 3 things to finalize:

1. ✅ Offline reads (Firestore persistence)
2. ✅ Upload existing data (migration)
3. ✅ User data export (compliance + backup)

After this, you have a **complete offline-first system** with:
- ✅ Cloud backup
- ✅ Offline support
- ✅ Auto-sync
- ✅ Conflict resolution
- ✅ Data export
- ✅ User visibility into sync status

Perfect for comparing fitness data over years! 💪
