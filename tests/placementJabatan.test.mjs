import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
const savePlacementJabatan = new Function("randomUUID", source.slice(source.indexOf("async function savePlacementJabatan("), source.indexOf("async function getJabatanMasterData(")) + "\nreturn savePlacementJabatan;")(randomUUID);

function databaseWithRows(initial = []) {
  const rows = structuredClone(initial);
  const matches = (row, where) => Object.entries(where).every(([key, value]) =>
    value && typeof value === "object" ? value.in.includes(row[key]) : row[key] === value);
  return { rows, tbl_jabatan_insanku: {
    findMany: async ({ where }) => rows.filter((row) => matches(row, where)),
    async upsert({ where, create, update }) {
      const existing = rows.find((row) => matches(row, where.uuid_outlet_insanku_uuid_jabatan_master));
      if (existing) { Object.assign(existing, update); return existing; }
      const added = { ...create, deleted_at: null }; rows.push(added); return added;
    },
    async create({ data }) { const row = { ...data, deleted_at: null }; rows.push(row); return row; },
    async update({ where, data }) { const row = rows.find((row) => matches(row, where)); Object.assign(row, data); return row; },
    async updateMany({ where, data }) { rows.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)); },
  } };
}

test("legacy placement without a position retains status without duplicating placeholders", async () => {
  const database = databaseWithRows();
  for (const is_active of [false, true, false]) {
    await savePlacementJabatan(database, { uuid_jabatan_master: "", jabatan_is_active: is_active }, "placement-a");
    assert.equal(database.rows.length, 1);
    assert.equal(database.rows[0].uuid_jabatan_master, null);
    assert.equal(database.rows[0].is_active, is_active);
  }
});

test("multiple positions keep separate statuses, survive repeated saves, and do not affect another placement", async () => {
  const database = databaseWithRows([{ uuid: "other", uuid_outlet_insanku: "placement-b", uuid_jabatan_master: "position-a", is_active: true, deleted_at: null }]);
  const selected = { jabatan_list: [{ uuid_jabatan_master: "position-a", is_active: true }, { uuid_jabatan_master: "position-b", is_active: false }] };
  await savePlacementJabatan(database, selected, "placement-a");
  const ids = database.rows.map((row) => row.uuid);
  await savePlacementJabatan(database, selected, "placement-a");
  assert.deepEqual(database.rows.map((row) => row.uuid), ids);
  const saved = database.rows.filter((row) => row.uuid_outlet_insanku === "placement-a");
  assert.equal(saved.length, 2);
  assert.equal(saved[0].is_active, true);
  assert.equal(saved[1].is_active, false);
  assert.equal(database.rows[0].is_active, true);
});

test("removing one position keeps the other and readding restores the existing row", async () => {
  const database = databaseWithRows();
  const a = { uuid_jabatan_master: "a", is_active: true }, b = { uuid_jabatan_master: "b", is_active: true };
  await savePlacementJabatan(database, { jabatan_list: [a, b] }, "placement-a");
  const oldUuid = database.rows[1].uuid;
  await savePlacementJabatan(database, { jabatan_list: [a] }, "placement-a");
  assert.equal(database.rows[0].deleted_at, null);
  assert.ok(database.rows[1].deleted_at);
  assert.equal(database.rows[1].is_active, false);
  await savePlacementJabatan(database, { jabatan_list: [a, b] }, "placement-a");
  assert.equal(database.rows.length, 2);
  assert.equal(database.rows[1].uuid, oldUuid);
  assert.equal(database.rows[1].deleted_at, null);
  await savePlacementJabatan(database, { jabatan_list: [] }, "placement-a");
  assert.equal(database.rows.filter((row) => !row.deleted_at).length, 0);
});

const syncSource = readFileSync(new URL("../src/services/outletInsanKuService.js", import.meta.url), "utf8");
const { isActiveJabatanRow } = await import("../src/lib/outletInsanKuStatus.js");
const buildJabatanRelationMap = new Function("isActiveJabatanRow", syncSource.slice(syncSource.indexOf("function buildRelationKey("), syncSource.indexOf("function normalizeOutletInsanKuRows(")) + "\nreturn buildJabatanRelationMap;")(isActiveJabatanRow);
const upsertJabatanInsanKu = new Function("randomUUID", syncSource.slice(syncSource.indexOf("async function upsertJabatanInsanKu("), syncSource.indexOf("export async function syncOutletInsanKu(")) + "\nreturn upsertJabatanInsanKu;")(randomUUID);

test("sync retains every active position, deduplicates payload rows, and removes positions absent on resync", async () => {
  const payload = [
    { cabangs_id: "outlet", karyawans_id: "person", jabatans_id: "a", active: 1 },
    { cabangs_id: "outlet", karyawans_id: "person", jabatans_id: "b", active: 1 },
    { cabangs_id: "outlet", karyawans_id: "person", jabatans_id: "b", active: 1 },
    { cabangs_id: "outlet", karyawans_id: "person", jabatans_id: "old", active: 0 },
  ];
  const selected = buildJabatanRelationMap(payload).get("outlet:person");
  assert.deepEqual(selected, ["a", "b"]);
  const database = databaseWithRows();
  database.tbl_jabatan_master = { upsert: async () => {} };
  database.tbl_jabatan_insanku.updateMany = async ({ where, data }) => {
    database.rows.filter((row) => row.uuid_outlet_insanku === where.uuid_outlet_insanku && !row.deleted_at &&
      (!where.OR || !selectedForRemoval(where).includes(row.uuid_jabatan_master)))
      .forEach((row) => Object.assign(row, data));
  };
  function selectedForRemoval(where) { return where.OR[0].uuid_jabatan_master.notIn; }
  const args = { uuid_outlet_insanku: "placement-a", jabatan_master_map: new Map(), uuid_jabatan_masters: selected };
  await upsertJabatanInsanKu(database, args);
  assert.equal(database.rows.filter((row) => !row.deleted_at).length, 2);
  const ids = database.rows.map((row) => row.uuid);
  await upsertJabatanInsanKu(database, args);
  assert.deepEqual(database.rows.map((row) => row.uuid), ids);
  await upsertJabatanInsanKu(database, { ...args, uuid_jabatan_masters: ["b"] });
  assert.ok(database.rows[0].deleted_at);
  assert.equal(database.rows[1].deleted_at, null);
  await upsertJabatanInsanKu(database, { ...args, uuid_jabatan_masters: [] });
  assert.equal(database.rows.filter((row) => !row.deleted_at).length, 0);
});

test("placement input accepts all selected positions and rejects duplicate positions", () => {
  const normalize = new Function(source.slice(source.indexOf("function normalizeOutletPlacements("), source.indexOf("function getInsanKuPayloadUuid(")) + "\nreturn normalizeOutletPlacements;")();
  const placement = { outlet_uuid: "outlet", jabatan_list: [{ uuid_jabatan_master: "a", is_active: true }, { uuid_jabatan_master: "b", is_active: false }] };
  const saved = normalize([placement]).placements[0];
  assert.deepEqual(saved.jabatan_list, placement.jabatan_list);
  assert.throws(() => normalize([{ ...placement, jabatan_list: [placement.jabatan_list[0], placement.jabatan_list[0]] }]), /Jabatan yang sama/);
});

test("settings returns every position for a placement", async () => {
  let query;
  const positions = ["a", "b"].map((uuid) => ({ is_active: true, jabatan_master: { uuid, name: `Position ${uuid}` } }));
  const getSettings = new Function("prisma", "formatDateInput", "getGofitkuSetupWindow", "isWithinGofitkuSetupWindow",
    source.slice(source.indexOf("export async function getInsanKuSettingsData("), source.indexOf("export async function syncInsanKu(")).replace("export ", "") + "\nreturn getInsanKuSettingsData;")(
      { tbl_insanku: { findMany: async (args) => {
        query = args;
        return [{ uuid: "person", name: "Person", is_active: true, gofitku_exclusion_periods: [], outlet_insanku: [{ uuid: "placement-a", is_active: true, outlet: { uuid: "outlet", name: "Outlet" }, jabatan_insanku: positions }] }];
      } } }, () => "", () => ({}), () => true,
    );
  const [person] = await getSettings();
  assert.equal(query.select.outlet_insanku.select.jabatan_insanku.take, undefined);
  assert.deepEqual(person.outlet_placements[0].jabatan_list.map((position) => position.uuid_jabatan_master), ["a", "b"]);
  assert.equal(person.outlet_placements.length, 1);
});
