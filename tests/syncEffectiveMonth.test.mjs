import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { jabatanPlacementStatuses, activeJabatanAssignments } from "../src/lib/outletInsanKuStatus.js";
import { currentPlacementMonth, currentPlacementDay } from "../src/lib/placementMonth.js";
import { buildPlacementMapping } from "../src/lib/placementMapping.js";
import { isGofitkuRelationAvailableOnDate } from "../src/lib/penjualanGofitkuReport.js";
import { buildPreActivePeriodData, createInsanKuPreActivePeriod, closeInsanKuInactivePeriod, openInsanKuInactivePeriod, closeOutletInsanKuInactivePeriod, openOutletInsanKuInactivePeriod } from "../src/services/inactivePeriodService.js";

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((part) => matches(row, part));
    if (value === null) return row[key] == null;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return (!("in" in value) || value.in.includes(row[key])) && (!("notIn" in value) || !value.notIn.includes(row[key]))
        && (!("gte" in value) || row[key] >= value.gte) && (!("lt" in value) || row[key] < value.lt);
    }
    return row[key] === value;
  });
}
function periodModel(records) {
  return {
    create: async ({ data }) => { const row = { ...data, deleted_at: null }; records.push(row); return row; },
    findFirst: async ({ where }) => records.find((row) => matches(row, where)),
    updateMany: async ({ where, data }) => records.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)),
  };
}
function load(source, dependencies, result) {
  return new Function(...Object.keys(dependencies), `${source}\nreturn ${result};`)(...Object.values(dependencies));
}
function fixture() {
  let now = new Date("2026-10-29T05:00:00Z");
  let incomingPeople = [{ uuid: "new", name: "New", username: "new", is_active: true, is_slip_gaji_account: true }];
  let incomingPositions = [];
  let incomingPlacements = [{ uuid_outlet: "outlet-a", uuid_insanku: "new" }];
  const people = [], placements = [], employeePeriods = [], placementPeriods = [];
  const outlets = [{ uuid: "outlet-a", name: "A" }, { uuid: "outlet-b", name: "B" }];
  let skipInsert = false;
  const database = {
    async $transaction(callback) { return callback(database); },
    tbl_insanku: {
      findMany: async ({ where } = {}) => people.filter((row) => matches(row, where)),
      async createMany({ data }) {
        if (skipInsert) return { count: 0 };
        const added = data.filter((row) => !people.some((person) => row.uuid === person.uuid));
        people.push(...added.map((row) => ({ ...row, created_at: now, deleted_at: null })));
        return { count: added.length };
      },
      update: async ({ where, data }) => Object.assign(people.find((row) => matches(row, where)), data),
      updateMany: async ({ where, data }) => people.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)),
    },
    tbl_outlet: { findMany: async () => outlets },
    tbl_outlet_insanku: {
      findMany: async ({ where } = {}) => placements.filter((row) => matches(row, where)),
      async updateMany({ where, data }) {
        const rows = placements.filter((row) => matches(row, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      async upsert({ where, create, update }) {
        const existing = placements.find((row) => matches(row, where.uuid_outlet_uuid_insanku));
        if (existing) { Object.assign(existing, update); return existing; }
        const { inactive_periods, target_gofitku: _target, ...fields } = create;
        const row = { ...fields, created_at: now, deleted_at: null };
        placements.push(row);
        if (inactive_periods) await database.tbl_outlet_insanku_inactive_period.create({ data: { ...inactive_periods.create, uuid_outlet_insanku: row.uuid } });
        return row;
      },
    },
    tbl_jabatan_insanku: { updateMany: async () => ({ count: 0 }) },
    tbl_insanku_inactive_period: periodModel(employeePeriods),
    tbl_outlet_insanku_inactive_period: periodModel(placementPeriods),
  };
  const common = {
    prisma: database, randomUUID, currentPlacementMonth, currentPlacementDay: () => currentPlacementDay(now),
    fetchInsanKuPayload: async () => incomingPeople, fetchOutletInsanKuPayload: async () => incomingPlacements,
    normalizeInsanKuRows: (rows) => rows, closeOutletInsanKuInactivePeriod, openOutletInsanKuInactivePeriod,
  };
  const employeeSource = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
  const syncPeople = load(employeeSource.slice(employeeSource.indexOf("export async function syncInsanKu()"), employeeSource.indexOf("export async function getInsanKu()")).replace("export ", ""), {
    ...common, normalizeOutletInsanKuUsernames: () => new Map(), normalizeUsernameKey: (value) => value,
    hashPassword: async () => "hash", DEFAULT_INSANKU_PASSWORD: "test", closeInsanKuInactivePeriod, openInsanKuInactivePeriod, createInsanKuPreActivePeriod,
  }, "syncInsanKu");
  const placementSource = readFileSync(new URL("../src/services/outletInsanKuService.js", import.meta.url), "utf8");
  const syncPlacements = load(placementSource.slice(placementSource.indexOf("export async function syncOutletInsanKu()"), placementSource.indexOf("export async function getOutletInsanKu()")).replace("export ", ""), {
    ...common, jabatanPlacementStatuses, activeJabatanAssignments, fetchJabatanPayload: async () => [], fetchJabatanInsanKuPayload: async () => incomingPositions,
    normalizeJabatanRows: () => [], buildJabatanRelationMap: () => new Map(),
    normalizeOutletInsanKuRows: () => ({ placement_rows: incomingPlacements, valid_rows: incomingPlacements, unique_rows: incomingPlacements }),
    buildDefaultPlacementTarget: () => ({}), buildPreActivePeriodData, upsertJabatanInsanKu: async () => false,
    buildRelationKey: (row) => `${row.uuid_outlet}:${row.uuid_insanku}`, applyJabatanGofitkuExclusions: async () => 0,
  }, "syncOutletInsanKu");
  function view() {
    return people.map((person) => ({ ...person, inactive_periods: employeePeriods.filter((row) => row.uuid_insanku === person.uuid),
      outlet_insanku: placements.filter((row) => row.uuid_insanku === person.uuid).map((row) => ({ ...row,
        outlet: outlets.find((outlet) => outlet.uuid === row.uuid_outlet),
        inactive_periods: placementPeriods.filter((period) => period.uuid_outlet_insanku === row.uuid),
      })),
    }));
  }
  return { syncPeople, syncPlacements, people, placements, employeePeriods, placementPeriods, view,
    setNow(value) { now = new Date(value); }, setPeople(rows) { incomingPeople = rows; }, setPlacements(rows) { incomingPlacements = rows; }, setPositions(rows) { incomingPositions = rows; }, skipInsert() { skipInsert = true; } };
}

test("new synced person and placement are effective for the whole sync month, never earlier", async () => {
  const f = fixture();
  await f.syncPeople(); await f.syncPlacements();
  assert.equal(f.employeePeriods[0].end_date.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(f.placementPeriods[0].end_date.toISOString(), "2026-09-30T00:00:00.000Z");
  const [person] = f.view();
  const relation = { ...person.outlet_insanku[0], insanku: person };
  assert.equal(isGofitkuRelationAvailableOnDate(relation, "2026-09-30"), false);
  assert.equal(isGofitkuRelationAvailableOnDate(relation, "2026-10-01"), true);
  const mapped = buildPlacementMapping([person], 2026).people[0];
  assert.equal(mapped.months[8].segments.length, 0);
  assert.equal(mapped.months[9].segments[0].start_date, "2026-10-01");
});

test("resync in November preserves October starts; a genuinely new placement starts in November", async () => {
  const f = fixture();
  await f.syncPeople(); await f.syncPlacements();
  const before = structuredClone([f.employeePeriods, f.placementPeriods]);
  f.setNow("2026-11-18T05:00:00Z");
  f.setPlacements([{ uuid_insanku: "new", uuid_outlet: "outlet-a" }, { uuid_insanku: "new", uuid_outlet: "outlet-b" }]);
  await f.syncPeople(); await f.syncPlacements();
  assert.deepEqual(f.employeePeriods, before[0]);
  assert.deepEqual(f.placementPeriods.slice(0, 1), before[1]);
  assert.equal(f.placementPeriods.length, 2);
  assert.equal(f.placementPeriods[1].end_date.toISOString(), "2026-10-31T00:00:00.000Z");
  const mapped = buildPlacementMapping(f.view(), 2026).people[0];
  assert.deepEqual(mapped.months[9].segments.map((row) => row.outlet_name), ["A"]);
  assert.deepEqual(mapped.months[10].segments.map((row) => row.outlet_name), ["A", "B"]);
});

test("sync month uses Makassar at year rollover and initial history is not written for skipped duplicates", async () => {
  const f = fixture(); f.setNow("2026-12-31T16:00:00Z");
  await f.syncPeople(); await f.syncPlacements();
  assert.equal(f.employeePeriods[0].end_date.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.equal(f.placementPeriods[0].end_date.toISOString(), "2026-12-31T00:00:00.000Z");
  const duplicate = fixture(); duplicate.skipInsert();
  assert.equal((await duplicate.syncPeople()).summary.inserted_insanku, 0);
  assert.equal(duplicate.employeePeriods.length, 0);
});


test("sync updates praktek, combined and empty status while missing flags and skipped placements preserve it", async () => {
  const f = fixture();
  await f.syncPeople();
  for (const [izin, praktek, status] of [["0", "1", "praktek"], [1, 1, "izin_praktek"], [0, 0, null]]) {
    f.setPositions([{ karyawans_id: "new", cabangs_id: "outlet-a", active: 1, ijin: izin, praktek }]);
    await f.syncPlacements();
    assert.equal(f.placements[0].status, status);
  }
  f.placements[0].status = "praktek";
  f.setPositions([]);
  await f.syncPlacements();
  assert.equal(f.placements[0].status, "praktek");
  f.placements[0].is_skip_sync = true;
  f.setPositions([{ karyawans_id: "new", cabangs_id: "outlet-a", active: 1, ijin: 1, praktek: 1 }]);
  await f.syncPlacements();
  assert.equal(f.placements[0].status, "praktek");
});

test("izin-only new placements are never created or recreated on resync", async () => {
  const f = fixture(); await f.syncPeople();
  f.setPositions([{ karyawans_id: "new", cabangs_id: "outlet-a", active: 1, ijin: 1, praktek: 0 }]);
  for (let index = 0; index < 2; index += 1) {
    const result = await f.syncPlacements();
    assert.equal(result.summary.synced_outlet_insanku, 0);
    assert.equal(f.placements.length, 0);
    assert.equal(f.placementPeriods.length, 0);
  }
  assert.equal(f.people[0].is_active, true);
});

test("existing izin-only placement is removed while practice at another outlet remains and can later be restored", async () => {
  const f = fixture(); await f.syncPeople(); await f.syncPlacements();
  const original = f.placements[0];
  f.setPlacements([{ uuid_insanku: "new", uuid_outlet: "outlet-a" }, { uuid_insanku: "new", uuid_outlet: "outlet-b" }]);
  f.setPositions([
    { karyawans_id: "new", cabangs_id: "outlet-a", active: 1, ijin: 1, praktek: 0 },
    { karyawans_id: "new", cabangs_id: "outlet-b", active: 1, ijin: 0, praktek: 1 },
  ]);
  const result = await f.syncPlacements();
  assert.equal(result.summary.deleted_izin_outlet_insanku, 1);
  assert.equal(original.status, "izin");
  assert.equal(original.is_active, false);
  assert.ok(original.deleted_at);
  assert.equal(f.placements[1].status, "praktek");
  assert.equal(f.placements[1].deleted_at, null);
  assert.equal(f.people[0].is_active, true);
  assert.equal((await f.syncPlacements()).summary.deleted_izin_outlet_insanku, 0);
  assert.equal(f.placements.length, 2);
  f.setPositions([
    { karyawans_id: "new", cabangs_id: "outlet-a", active: 1, ijin: 1, praktek: 1 },
    { karyawans_id: "new", cabangs_id: "outlet-b", active: 1, ijin: 0, praktek: 1 },
  ]);
  await f.syncPlacements();
  assert.equal(original.status, "izin_praktek");
  assert.equal(original.deleted_at, null);
  assert.equal(original.is_active, true);
  assert.equal(f.placements.length, 2);
});

test("stored izin-only status is removed even when flags are absent and never revived from missing flags", async () => {
  const f = fixture(); await f.syncPeople(); await f.syncPlacements();
  const original = f.placements[0]; original.status = "izin";
  original.is_skip_sync = true;
  assert.equal((await f.syncPlacements()).summary.deleted_izin_outlet_insanku, 1);
  assert.ok(original.deleted_at);
  assert.equal((await f.syncPlacements()).summary.synced_outlet_insanku, 0);
  assert.ok(original.deleted_at);
  assert.equal(f.placements.length, 1);
});


test("empty employee response aborts sync without deactivating existing data", async () => {
  const f = fixture(); await f.syncPeople(); await f.syncPlacements();
  const before = structuredClone([f.people, f.placements, f.employeePeriods, f.placementPeriods]);
  f.setPeople([]);
  await assert.rejects(f.syncPeople(), /dibatalkan agar data lama tetap aman/);
  await assert.rejects(f.syncPlacements(), /dibatalkan agar data lama tetap aman/);
  assert.deepEqual([f.people, f.placements, f.employeePeriods, f.placementPeriods], before);
});

test("empty placement response aborts sync without removing existing assignments", async () => {
  const f = fixture(); await f.syncPeople(); await f.syncPlacements();
  const before = structuredClone([f.people, f.placements, f.employeePeriods, f.placementPeriods]);
  f.setPlacements([]);
  await assert.rejects(f.syncPlacements(), /dibatalkan agar data lama tetap aman/);
  assert.deepEqual([f.people, f.placements, f.employeePeriods, f.placementPeriods], before);
});
