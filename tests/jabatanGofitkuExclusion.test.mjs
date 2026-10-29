import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyJabatanGofitkuExclusions, getJabatanGofitkuExclusions, saveJabatanGofitkuExclusions } from "../src/services/jabatanGofitkuExclusionService.js";

// Evaluate the Prisma query against fixture records, including the actual relation filters.
function matches(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return condition.some((part) => matches(row, part));
    const value = row[key];
    if (condition === null) return value == null;
    if (condition instanceof Date) return value?.getTime() === condition.getTime();
    if (typeof condition !== "object") return value === condition;
    if ("in" in condition) return condition.in.includes(value);
    if ("some" in condition) return (value ?? []).some((item) => matches(item, condition.some));
    if ("gte" in condition) return value != null && value >= condition.gte;
    return value != null && matches(value, condition);
  });
}

function fixture() {
  let state = {
    positions: [{ uuid: "selected", name: "Apoteker", deleted_at: null }, { uuid: "other", name: "Kasir", deleted_at: null }, { uuid: "deleted", name: "Lama", deleted_at: new Date() }],
    settings: [], people: [], exclusions: [],
  };
  const tx = {
    async $queryRaw() {},
    tbl_jabatan_master: {
      count: async ({ where }) => state.positions.filter((row) => matches(row, where)).length,
      findMany: async ({ where }) => state.positions.filter((row) => matches(row, where)).map((row) => ({
        uuid: row.uuid, name: row.name,
        pengecualian_jabatan: state.settings.filter((setting) => setting.uuid_jabatan_master === row.uuid && !setting.deleted_at),
      })),
    },
    tbl_pengecualian_jabatan: {
      async updateMany({ where, data }) { state.settings.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)); },
      async createMany({ data }) { state.settings.push(...data.map((row) => ({ ...row, deleted_at: null }))); },
    },
    tbl_insanku: {
      async findMany({ where }) {
        return state.people.map((person) => ({ ...person, outlet_insanku: person.outlet_insanku.map((placement) => ({
          ...placement, jabatan_insanku: placement.jabatan_insanku.map((position) => ({ ...position, jabatan_master: {
            ...state.positions.find((row) => row.uuid === position.uuid_jabatan_master),
            pengecualian_jabatan: state.settings.filter((row) => row.uuid_jabatan_master === position.uuid_jabatan_master),
          } })),
        })) })).filter((row) => matches(row, where));
      },
      async update({ where, data }) { Object.assign(state.people.find((row) => row.uuid === where.uuid), data); },
    },
    tbl_insanku_gofitku_exclusion: {
      findFirst: async ({ where }) => state.exclusions.find((row) => matches(row, where)),
      async create({ data }) { state.exclusions.push({ ...data, deleted_at: null }); },
    },
  };
  const database = { ...tx, async $transaction(callback) {
    const before = structuredClone(state);
    try { return await callback(tx); } catch (error) { state = before; throw error; }
  } };
  return { database, tx, get state() { return state; } };
}

function person(uuid, position = "selected", changes = {}) {
  return { uuid, is_active: true, is_slip_gaji_account: true, deleted_at: null, is_gofitku_setup_pending: true,
    outlet_insanku: [{ deleted_at: null, is_active: true, jabatan_insanku: [{ deleted_at: null, is_active: true, uuid_jabatan_master: position }] }], ...changes };
}
const now = new Date("2026-10-29T16:30:00.000Z"); // October 30 in Makassar.

test("saved position selections persist, deduplicate, replace and allow clearing all", async () => {
  const f = fixture();
  await saveJabatanGofitkuExclusions(f.database, ["selected", "selected"]);
  assert.equal(f.state.settings.length, 1);
  assert.deepEqual((await getJabatanGofitkuExclusions(f.database)).map((row) => [row.uuid, row.is_excluded]), [["selected", true], ["other", false]]);
  await saveJabatanGofitkuExclusions(f.database, ["other"]);
  assert.deepEqual((await getJabatanGofitkuExclusions(f.database)).map((row) => row.is_excluded), [false, true]);
  await saveJabatanGofitkuExclusions(f.database, []);
  assert.ok((await getJabatanGofitkuExclusions(f.database)).every((row) => !row.is_excluded));
});

test("invalid and stale positions leave the saved configuration unchanged", async () => {
  const f = fixture();
  await saveJabatanGofitkuExclusions(f.database, ["selected"]);
  const before = structuredClone(f.state);
  for (const ids of [undefined, null, "selected", [null], [" "], ["missing"], ["deleted"]]) {
    await assert.rejects(saveJabatanGofitkuExclusions(f.database, ids));
    assert.deepEqual(f.state, before);
  }
});

test("sync excludes matching active employees once, with permanent exclusion", async () => {
  const f = fixture();
  await saveJabatanGofitkuExclusions(f.database, ["selected"]);
  f.state.people.push(person("new"), person("existing", "selected", { is_gofitku_setup_pending: false }), person("other", "other"), person("inactive", "selected", { is_active: false }), person("deleted", "selected", { deleted_at: now }), person("non-slip", "selected", { is_slip_gaji_account: false }), person("not-synced"), person("inactive-position"), person("inactive-placement"));
  f.state.people.find((row) => row.uuid === "inactive-position").outlet_insanku[0].jabatan_insanku[0].is_active = false;
  f.state.people.find((row) => row.uuid === "inactive-placement").outlet_insanku[0].is_active = false;
  const ids = f.state.people.filter((row) => row.uuid !== "not-synced").map((row) => row.uuid);
  assert.equal(await applyJabatanGofitkuExclusions(f.tx, ids, now), 2);
  assert.deepEqual(f.state.exclusions.map((row) => row.uuid_insanku), ["new", "existing"]);
  assert.ok(f.state.exclusions.every((row) => row.start_date.toISOString() === "1970-01-01T00:00:00.000Z" && row.end_date === null));
  assert.equal(f.state.people[0].is_gofitku_setup_pending, false);
  assert.equal(await applyJabatanGofitkuExclusions(f.tx, ids, now), 0);
  assert.equal(f.state.exclusions.length, 2);
});

test("sync preserves retained date columns while all existing exclusions apply permanently", async () => {
  const f = fixture();
  await saveJabatanGofitkuExclusions(f.database, ["selected"]);
  f.state.people.push(person("current"), person("scheduled"), person("expired"));
  f.state.exclusions.push(
    { uuid: "manual-current", uuid_insanku: "current", start_date: new Date("2026-10-01"), end_date: new Date("2026-10-31"), deleted_at: null },
    { uuid: "manual-future", uuid_insanku: "scheduled", start_date: new Date("2026-11-01"), end_date: null, deleted_at: null },
    { uuid: "old", uuid_insanku: "expired", start_date: new Date("2026-09-01"), end_date: new Date("2026-09-30"), deleted_at: null },
  );
  const before = structuredClone(f.state.exclusions);
  assert.equal(await applyJabatanGofitkuExclusions(f.tx, ["current", "scheduled", "expired"], now), 0);
  assert.deepEqual(f.state.exclusions.slice(0, 3), before);
  assert.equal(f.state.exclusions.length, 3);
  await saveJabatanGofitkuExclusions(f.database, []);
  const all = structuredClone(f.state.exclusions);
  assert.equal(await applyJabatanGofitkuExclusions(f.tx, ["current", "scheduled", "expired"], now), 0);
  assert.deepEqual(f.state.exclusions, all);
});

test("placement sync applies position exclusions after updating placements in the same transaction", async () => {
  const source = readFileSync(new URL("../src/services/outletInsanKuService.js", import.meta.url), "utf8");
  const syncSource = source.slice(source.indexOf("export async function syncOutletInsanKu()"), source.indexOf("export async function getOutletInsanKu()"));
  const events = [];
  const tx = {
    tbl_jabatan_master: { upsert: async () => events.push("master") },
    tbl_outlet_insanku: { upsert: async () => { events.push("placement"); return { uuid: "placement" }; }, findMany: async () => [] },
  };
  const sync = new Function("prisma", "fetchInsanKuPayload", "fetchOutletInsanKuPayload", "fetchJabatanPayload", "fetchJabatanInsanKuPayload", "normalizeJabatanRows", "buildJabatanRelationMap", "normalizeInsanKuRows", "normalizeOutletInsanKuRows", "randomUUID", "buildDefaultPlacementTarget", "closeOutletInsanKuInactivePeriod", "upsertJabatanInsanKu", "buildRelationKey", "applyJabatanGofitkuExclusions", syncSource.replace("export ", "") + "\nreturn syncOutletInsanKu;")(
    { tbl_outlet: { findMany: async () => [{ uuid: "outlet" }] }, tbl_insanku: { findMany: async () => [{ uuid: "employee" }] }, tbl_outlet_insanku: { findMany: async () => [] }, $transaction: (callback) => callback(tx) },
    async () => [], async () => [], async () => [], async () => [], () => [{ uuid: "position", name: "Position" }], () => new Map([["key", { uuid_jabatan_master: "position" }]]), () => [{ uuid: "employee" }],
    () => ({ placement_rows: [], valid_rows: [], unique_rows: [{ uuid_outlet: "outlet", uuid_insanku: "employee" }] }), () => "id", () => ({}), async () => {}, async () => { events.push("position"); return true; }, () => "key",
    async (transaction, ids) => { assert.equal(transaction, tx); assert.deepEqual(ids, ["employee"]); events.push("exclude"); return 1; },
  );
  assert.equal((await sync()).summary.auto_excluded_insanku, 1);
  assert.deepEqual(events, ["master", "placement", "position", "exclude"]);
});
