import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parsePlacementMonth, currentPlacementMonth } from "../src/lib/placementMonth.js";
import { permanentGofitkuExclusionDates, isGofitkuExcluded } from "../src/lib/gofitkuExclusion.js";
import { createOutletInsanKuPreActivePeriod, openOutletInsanKuInactivePeriod } from "../src/services/inactivePeriodService.js";

const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
const normalize = new Function(source.slice(source.indexOf("function normalizeOutletPlacements("), source.indexOf("function getInsanKuPayloadUuid(")) + "\nreturn { normalizeOutletPlacements, normalizeDeletedOutletPlacements };")();

function fixture() {
  const exclusions = [], starts = [], removals = [];
  const tx = {
    tbl_insanku: { update: async () => {} },
    tbl_insanku_gofitku_exclusion: {
      findFirst: async () => exclusions.find((row) => !row.deleted_at),
      create: async ({ data }) => exclusions.push({ ...data, deleted_at: null }),
      updateMany: async ({ data }) => exclusions.filter((row) => !row.deleted_at).forEach((row) => Object.assign(row, data)),
    },
    tbl_outlet_insanku: {
      findMany: async () => [{ uuid: "old-placement", uuid_outlet: "old-outlet", is_active: true, deleted_at: null }],
      updateMany: async () => {}, create: async () => {},
    },
    tbl_jabatan_insanku: { updateMany: async () => {} },
  };
  const dependencies = {
    prisma: { tbl_insanku: { findUnique: async () => ({ uuid: "employee", deleted_at: null, is_slip_gaji_account: true }) }, $transaction: async (callback) => callback(tx) },
    ...normalize, randomUUID, normalizeNik: (value) => value,
    parsePlacementMonth, currentPlacementMonth, permanentGofitkuExclusionDates,
    validateOutlets: async () => {}, validateJabatanMaster: async () => {}, closeInsanKuInactivePeriod: async () => {}, openInsanKuInactivePeriod: async () => {},
    openOutletInsanKuInactivePeriod: async (_tx, uuid, date) => removals.push({ uuid, date }),
    closeOutletInsanKuInactivePeriod: async () => {},
    createOutletInsanKuPreActivePeriod: async (_tx, _uuid, date) => starts.push(date),
    savePlacementJabatan: async () => {}, buildDefaultPlacementTarget: () => ({}),
    getInsanKuSettingsData: async () => [],
  };
  const update = new Function(...Object.keys(dependencies), source.slice(source.indexOf("export async function updateInsanKu("), source.indexOf("export async function getInsanKuNonSlipGaji("))
    .replace("export ", "") + "\nreturn updateInsanKu;")(...Object.values(dependencies));
  const payload = { uuid_insanku: "employee", name: "Employee", username: "employee", outlet_placements: [{ outlet_uuid: "new-outlet", active_start_date: "2026-11" }], deleted_outlet_placements: [{ uuid: "old-placement", inactive_start_date: "2026-10" }] };
  return { update, payload, exclusions, starts, removals };
}

test("placement month validation normalizes to the first day and accepts valid legacy dates", () => {
  for (const value of ["2026-10", "2026-10-29"]) assert.equal(parsePlacementMonth(value).toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(parsePlacementMonth("2028-02").toISOString(), "2028-02-01T00:00:00.000Z");
  assert.equal(currentPlacementMonth(new Date("2026-12-31T16:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
  for (const value of ["2026-13", "2026-00", "2026-1", "2026-02-30", "invalid", false]) assert.throws(() => parsePlacementMonth(value));
  assert.equal(parsePlacementMonth(""), null);
});

test("editing an employee applies addition and deletion at the beginning of each selected month", async () => {
  const f = fixture();
  await f.update(f.payload);
  assert.equal(f.starts[0].toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(f.removals[0].uuid, "old-placement");
  assert.equal(f.removals[0].date.toISOString(), "2026-10-01T00:00:00.000Z");
});

test("placement history excludes the entire period before the chosen month", async () => {
  const records = [];
  await createOutletInsanKuPreActivePeriod({ tbl_outlet_insanku_inactive_period: { create: async ({ data }) => records.push(data) } }, "placement", parsePlacementMonth("2028-03"));
  assert.equal(records[0].end_date.toISOString(), "2028-02-29T00:00:00.000Z");
  const model = { updateMany: async () => {}, findFirst: async () => null, create: async ({ data }) => records.push(data) };
  await openOutletInsanKuInactivePeriod({ tbl_outlet_insanku_inactive_period: model }, "placement", parsePlacementMonth("2026-12"));
  assert.equal(records[1].start_date.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("individual exclusion needs no dates, is idempotent, preserves old columns and can be disabled", async () => {
  const f = fixture();
  await f.update({ ...f.payload, is_exclude_penjualan_gofitku: true });
  assert.equal(f.exclusions.length, 1);
  assert.equal(f.exclusions[0].end_date, null);
  f.exclusions[0].start_date = new Date("2026-01-01");
  f.exclusions[0].end_date = new Date("2026-01-31");
  const original = structuredClone(f.exclusions[0]);
  await f.update({ ...f.payload, is_exclude_penjualan_gofitku: true, gofitku_exclusion_start_date: "invalid" });
  assert.deepEqual(f.exclusions, [original]);
  assert.equal(isGofitkuExcluded(f.exclusions), true);
  await f.update({ ...f.payload, is_exclude_penjualan_gofitku: false });
  assert.equal(isGofitkuExcluded(f.exclusions), false);
  assert.equal(f.exclusions[0].end_date.getTime(), original.end_date.getTime());
  await f.update({ ...f.payload, is_exclude_penjualan_gofitku: true });
  assert.equal(f.exclusions.length, 2);
  assert.equal(isGofitkuExcluded(f.exclusions), true);
});
