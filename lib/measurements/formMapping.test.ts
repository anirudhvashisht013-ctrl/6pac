import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMeasurementEntryFromForm,
  hydrateMeasurementForm,
  resolveMeasurementDate,
} from "@/lib/measurements/formMapping";

test("hydrateMeasurementForm converts cm values to inch inputs", () => {
  const hydrated = hydrateMeasurementForm({
    date: "2026-03-04",
    waist: null,
    chest: 2.54,
    shoulders: null,
    armsR: null,
    armsL: null,
    thighR: null,
    thighL: null,
    bicepsR: null,
    bicepsL: null,
    bodyFatPercent: 12.3,
    notes: "steady",
  });

  assert.equal(hydrated.form.chest, "1");
  assert.equal(hydrated.bodyFat, "12.3");
  assert.equal(hydrated.notes, "steady");
});

test("buildMeasurementEntryFromForm converts inch input to cm payload", () => {
  const payload = buildMeasurementEntryFromForm({
    date: "2026-03-04",
    form: {
      waist: "",
      chest: "1",
      shoulders: "",
      armsR: "",
      armsL: "",
      thighR: "",
      thighL: "",
      bicepsR: "",
      bicepsL: "",
    },
    bodyFat: "",
    notes: " ",
    loggedAt: "2026-03-04T10:00:00.000Z",
  });

  assert.equal(payload.chest, 2.54);
  assert.equal(payload.notes, null);
});

test("resolveMeasurementDate falls back when date param is missing/invalid", () => {
  const fallback = "2026-03-04";
  assert.equal(resolveMeasurementDate(undefined, fallback), fallback);
  assert.equal(resolveMeasurementDate("oops", fallback), fallback);
  assert.equal(resolveMeasurementDate("2026-03-01", fallback), "2026-03-01");
});
