import test from "node:test";
import assert from "node:assert/strict";
import {
  getMeasurementByDate,
  getMeasurementRange,
} from "@/lib/measurements/localMeasurementsQuery";
import type { BodyMeasurementEntry } from "@/lib/types";

function makeMeasurement(date: string, partial?: Partial<BodyMeasurementEntry>): BodyMeasurementEntry {
  return {
    date,
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

test("measurement date lookup returns matching local measurement or null", () => {
  const measurements = [
    makeMeasurement("2026-03-03"),
    makeMeasurement("2026-03-01"),
    makeMeasurement("2026-03-02"),
  ];

  const found = getMeasurementByDate(measurements, "2026-03-02");
  const missing = getMeasurementByDate(measurements, "2026-03-10");

  assert.equal(found?.date, "2026-03-02");
  assert.equal(missing, null);
});

test("measurement range filters inclusively and sorts by date", () => {
  const measurements = [
    makeMeasurement("2026-03-04"),
    makeMeasurement("2026-03-01"),
    makeMeasurement("2026-03-03"),
    makeMeasurement("2026-02-28"),
  ];

  const range = getMeasurementRange(measurements, "2026-03-01", "2026-03-03");
  assert.deepEqual(range.map((entry) => entry.date), ["2026-03-01", "2026-03-03"]);
});
