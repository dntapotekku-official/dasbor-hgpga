import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/services/insanKuService.js", import.meta.url),
  "utf8",
);
const savePlacementJabatan = new Function(
  "randomUUID",
  source.slice(
    source.indexOf("async function savePlacementJabatan("),
    source.indexOf("async function getJabatanMasterData("),
  ) + "\nreturn savePlacementJabatan;",
)(randomUUID);

function databaseWithRows(initial = []) {
  const rows = new Map(initial.map((row) => [row.uuid_outlet_insanku, row]));
  return {
    rows,
    tbl_jabatan_insanku: {
      async upsert({ where, create, update }) {
        const existing = rows.get(where.uuid_outlet_insanku);
        const row = existing ? { ...existing, ...update } : { ...create, deleted_at: null };
        rows.set(where.uuid_outlet_insanku, row);
        return row;
      },
      async updateMany({ where, data }) {
        const existing = rows.get(where.uuid_outlet_insanku);
        if (existing) rows.set(where.uuid_outlet_insanku, { ...existing, ...data });
      },
    },
  };
}

test("placement without a position retains its selected status on first save", async () => {
  for (const is_active of [true, false]) {
    const database = databaseWithRows();
    await savePlacementJabatan(database, {
      uuid_jabatan_master: "", jabatan_is_active: is_active,
    }, "placement-a");
    const saved = database.rows.get("placement-a");
    assert.ok(saved, "status must be stored even when no position record existed");
    assert.equal(saved.uuid_jabatan_master, null);
    assert.equal(saved.is_active, is_active);
  }
});

test("placement without a position can toggle active status without duplicating records", async () => {
  const database = databaseWithRows();
  let saved_uuid;
  for (const is_active of [false, true, false, true]) {
    await savePlacementJabatan(database, {
      uuid_jabatan_master: "", jabatan_is_active: is_active,
    }, "placement-a");
    const saved = database.rows.get("placement-a");
    assert.ok(saved);
    saved_uuid ??= saved.uuid;
    assert.equal(saved.uuid, saved_uuid);
    assert.equal(saved.is_active, is_active);
    assert.equal(database.rows.size, 1);
  }
});

test("clearing and assigning a position preserves the selected active status", async () => {
  const database = databaseWithRows([{
    uuid: "existing-record", uuid_outlet_insanku: "placement-a",
    uuid_jabatan_master: "position-a", is_active: false, deleted_at: new Date(),
  }]);
  for (const uuid_jabatan_master of ["", "position-b"]) {
    await savePlacementJabatan(database, {
      uuid_jabatan_master, jabatan_is_active: true,
    }, "placement-a");
    const saved = database.rows.get("placement-a");
    assert.equal(saved.uuid, "existing-record");
    assert.equal(saved.uuid_jabatan_master, uuid_jabatan_master || null);
    assert.equal(saved.is_active, true);
    assert.equal(saved.deleted_at, null);
  }
});
