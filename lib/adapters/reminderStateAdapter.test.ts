import test from "node:test";
import assert from "node:assert/strict";
import {
  getReminderRuntimeBoundary,
  getReminderSettingsBoundary,
  normalizeReminderStateRecord,
  toReminderSettingsMirrorBoundary,
  withReminderRuntimeBoundary,
  withReminderSettingsBoundary,
} from "@/lib/adapters/reminderStateAdapter";

test("normalizeReminderStateRecord safely defaults incomplete reminder state", () => {
  const normalized = normalizeReminderStateRecord(
    {
      id: "primary",
      version: 1,
      settings: {
        enabled: false,
      } as never,
      runtime: {} as never,
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z",
    },
    "test"
  );

  assert.equal(normalized.id, "primary");
  assert.equal(normalized.settings.enabled, false);
  assert.equal(typeof normalized.settings.measurement.time, "string");
  assert.deepEqual(normalized.runtime.snoozedUntil, {});
  assert.deepEqual(normalized.runtime.dismissedCycles, {});
});

test("settings and runtime boundaries can be updated independently", () => {
  const base = normalizeReminderStateRecord(null, "test-base");
  const withSettings = withReminderSettingsBoundary(base, {
    ...getReminderSettingsBoundary(base),
    enabled: false,
  });
  const withRuntime = withReminderRuntimeBoundary(withSettings, {
    ...getReminderRuntimeBoundary(withSettings),
    permissionStatus: "granted",
    updatedAt: "2026-03-12T10:00:00.000Z",
  });

  assert.equal(getReminderSettingsBoundary(withRuntime).enabled, false);
  assert.equal(getReminderRuntimeBoundary(withRuntime).permissionStatus, "granted");
});

test("settings mirror doc only includes syncable reminder settings boundary", () => {
  const state = withReminderRuntimeBoundary(normalizeReminderStateRecord(null, "test-mirror"), {
    ...getReminderRuntimeBoundary(normalizeReminderStateRecord(null, "test-mirror-runtime")),
    snoozedUntil: { abc: "2026-03-12T10:00:00.000Z" },
    dismissedCycles: { def: "2026-03-12T11:00:00.000Z" },
  });

  const mirror = toReminderSettingsMirrorBoundary(state);

  assert.equal(mirror.id, "primary");
  assert.equal(mirror.version, 1);
  assert.ok("settings" in mirror);
  assert.equal("runtime" in mirror, false);
});
