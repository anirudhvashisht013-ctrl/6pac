import test from "node:test";
import assert from "node:assert/strict";
import type { BodyMeasurementEntry, ISODate } from "@/lib/models";
import {
  buildCadenceSlots,
  canLogMeasurementDay,
  deriveMonthKeys,
  latestRealEntryOnOrBefore,
  prevRealEntryBefore,
  resolveMeasurementAnchor,
  slotStatus,
} from "@/lib/measurements/slots";

function makeEntry(
  date: ISODate,
  partial?: Partial<BodyMeasurementEntry>
): BodyMeasurementEntry {
  return {
    date,
    schemaVersion: 1,
    waist: null,
    chest: null,
    shoulders: null,
    armsR: null,
    armsL: null,
    thighR: null,
    thighL: null,
    bicepsR: null,
    bicepsL: null,
    bodyFatPercent: null,
    notes: null,
    ...partial,
  };
}

test("anchor + month keys follow first real entry cadence", () => {
  const entries = [
    makeEntry("2026-01-10", {
      waist: 81.2,
      loggedAt: "2026-01-10T07:30:00.000Z",
    }),
    makeEntry("2026-01-25", { waist: 80.8 }),
  ];

  const anchor = resolveMeasurementAnchor(entries);
  assert.ok(anchor);
  assert.equal(anchor?.toISOString(), "2026-01-10T07:30:00.000Z");

  const slots = buildCadenceSlots(anchor, "2026-03-10", new Date("2026-03-05T00:00:00.000Z"));
  const keys = deriveMonthKeys(anchor, slots, "2026-03-05");

  assert.deepEqual(keys, ["2026-01", "2026-02", "2026-03"]);
  assert.equal(slots[0]?.date, "2026-01-10");
});

test("slot status resolves done, upcoming, and missed", () => {
  const now = new Date("2026-03-10T10:00:00.000Z");
  const doneSlot = { date: "2026-03-01" as ISODate, scheduledAt: new Date("2026-03-01T06:00:00.000Z") };
  const upcomingSlot = { date: "2026-03-20" as ISODate, scheduledAt: new Date("2026-03-20T06:00:00.000Z") };
  const missedSlot = { date: "2026-03-05" as ISODate, scheduledAt: new Date("2026-03-05T06:00:00.000Z") };

  assert.equal(slotStatus(doneSlot, makeEntry("2026-03-01", { waist: 79.9 }), now), "done");
  assert.equal(slotStatus(upcomingSlot, null, now), "upcoming");
  assert.equal(slotStatus(missedSlot, null, now), "missed");
});

test("delta baseline helpers skip missed placeholders", () => {
  const sorted = [
    makeEntry("2026-01-01", { waist: 85 }),
    makeEntry("2026-01-16"),
    makeEntry("2026-01-31", { waist: 84 }),
  ];

  const prev = prevRealEntryBefore(sorted, "2026-01-31");
  assert.equal(prev?.date, "2026-01-01");

  const baselineForMissed = latestRealEntryOnOrBefore(sorted, "2026-01-20");
  assert.equal(baselineForMissed?.date, "2026-01-01");
});

test("future slot day is blocked for logging", () => {
  const now = new Date("2026-03-10T14:00:00.000Z");
  assert.equal(canLogMeasurementDay("2026-03-11", now), false);
  assert.equal(canLogMeasurementDay("2026-03-10", now), true);
  assert.equal(canLogMeasurementDay("2026-03-09", now), true);
});
