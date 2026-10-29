import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parsePlacementMonth, currentPlacementMonth, currentPlacementDay } from "../src/lib/placementMonth.js";
import { permanentGofitkuExclusionDates, isGofitkuExcluded } from "../src/lib/gofitkuExclusion.js";
import { createOutletInsanKuPreActivePeriod, openOutletInsanKuInactivePeriod } from "../src/services/inactivePeriodService.js";

const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
const normalize = new Function(source.slice(source.indexOf("function normalizeOutletPlacements("), source.indexOf("function getInsanKuPayloadUuid(")) + "\nreturn { normalizeOutletPlacements, normalizeDeletedOutletPlacements };")();

function fixture(storedActive = true) {
  const exclusions = [], starts = [], removals = [], closedPlacements = [], closedEmployees = [], employeeWrites = [];
  const tx = {
    tbl_insanku: { update: async ({ data }) => employeeWrites.push(data) },
    tbl_insanku_gofitku_exclusion: {
      findFirst: async () => exclusions.find((row) => !row.deleted_at),
      create: async ({ data }) => exclusions.push({ ...data, deleted_at: null }),
      updateMany: async ({ data }) => exclusions.filter((row) => !row.deleted_at).forEach((row) => Object.assign(row, data)),
    },
    tbl_outlet_insanku: {
      findMany: async () => [{ uuid: "old-placement", uuid_outlet: "old-outlet", is_active: true, deleted_at: null }],
      updateMany: async () => {}, update: async () => {}, create: async () => {},
    },
    tbl_jabatan_insanku: { updateMany: async () => {} },
  };
  const dependencies = {
    prisma: { tbl_insanku: { findUnique: async () => ({ uuid: "employee", deleted_at: null, is_slip_gaji_account: true, is_active: storedActive }) }, $transaction: async (callback) => callback(tx) },
    ...normalize, randomUUID, normalizeNik: (value) => value,
    parsePlacementMonth, currentPlacementMonth, currentPlacementDay, permanentGofitkuExclusionDates,
    validateOutlets: async () => {}, validateJabatanMaster: async () => {}, closeInsanKuInactivePeriod: async (...args) => closedEmployees.push(args), openInsanKuInactivePeriod: async () => {},
    openOutletInsanKuInactivePeriod: async (_tx, uuid, date) => removals.push({ uuid, date }),
    closeOutletInsanKuInactivePeriod: async (...args) => closedPlacements.push(args),
    createOutletInsanKuPreActivePeriod: async (_tx, _uuid, date) => starts.push(date),
    savePlacementJabatan: async () => {}, buildDefaultPlacementTarget: () => ({}),
    getInsanKuSettingsData: async () => [],
  };
  const update = new Function(...Object.keys(dependencies), source.slice(source.indexOf("export async function updateInsanKu("), source.indexOf("export async function getInsanKuNonSlipGaji("))
    .replace("export ", "") + "\nreturn updateInsanKu;")(...Object.values(dependencies));
  const payload = { uuid_insanku: "employee", name: "Employee", username: "employee", outlet_placements: [{ outlet_uuid: "new-outlet", active_start_date: "2026-11" }], deleted_outlet_placements: [{ uuid: "old-placement", inactive_start_date: "2026-10" }] };
  return { update, payload, exclusions, starts, removals, closedPlacements, closedEmployees, employeeWrites };
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


test("saving a name with an unchanged placement must not rewrite historical inactive periods", async () => {
  const f = fixture();
  await f.update({ ...f.payload, outlet_placements: [{ uuid: "old-placement", outlet_uuid: "old-outlet" }], deleted_outlet_placements: [] });
  assert.equal(f.closedPlacements.length, 0);
  assert.equal(f.closedEmployees.length, 0);
});

test("omitting the hidden active field preserves an inactive employee", async () => {
  const f = fixture(false);
  await f.update({ ...f.payload, outlet_placements: [{ uuid: "old-placement", outlet_uuid: "old-outlet" }], deleted_outlet_placements: [] });
  assert.equal(f.employeeWrites[0].is_active, false);
  assert.equal(f.closedEmployees.length, 0);
});

test("repeating an inactive state keeps the same history row and its original start", async () => {
  const records = [];
  const model = {
    findFirst: async () => records.find((row) => !row.deleted_at && !row.end_date),
    updateMany: async ({ where, data }) => records.filter((row) => !row.deleted_at && row.start_date >= where.start_date.gte).forEach((row) => Object.assign(row, data)),
    create: async ({ data }) => { const row = { ...data, deleted_at: null }; records.push(row); return row; },
  };
  const tx = { tbl_outlet_insanku_inactive_period: model };
  const first = await openOutletInsanKuInactivePeriod(tx, "placement", new Date("2026-10-10"));
  const sameDay = await openOutletInsanKuInactivePeriod(tx, "placement", new Date("2026-10-10"));
  const later = await openOutletInsanKuInactivePeriod(tx, "placement", new Date("2026-10-29"));
  assert.equal(sameDay.uuid, first.uuid);
  assert.equal(later.uuid, first.uuid);
  assert.equal(records.length, 1);
  assert.equal(records[0].start_date.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(records[0].deleted_at, null);
});

test("a placement without a position defaults its next assigned position to active, while stored inactive stays inactive", async () => {
  const people = [[], [{ is_active: false, jabatan_master: { uuid: 'position', name: 'Position' } }]].map((positions, index) => ({
    uuid: `employee-${index}`, name: 'Employee', is_active: true, created_at: new Date(),
    gofitku_exclusion_periods: [], outlet_insanku: [{ uuid: `placement-${index}`, is_active: true, outlet: { uuid: 'outlet', name: 'Outlet' }, jabatan_insanku: positions }],
  }));
  const getSettings = new Function('prisma', 'formatDateInput', 'getGofitkuSetupWindow', 'isWithinGofitkuSetupWindow',
    source.slice(source.indexOf('export async function getInsanKuSettingsData('), source.indexOf('export async function syncInsanKu(')).replace('export ', '') + '\nreturn getInsanKuSettingsData;')(
      { tbl_insanku: { findMany: async () => people } }, () => '', () => ({}), () => true,
    );
  const result = await getSettings();
  assert.equal(result[0].outlet_placements[0].jabatan_is_active, true);
  assert.equal(result[1].outlet_placements[0].jabatan_is_active, false);
});
