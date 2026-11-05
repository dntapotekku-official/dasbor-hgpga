import assert from "node:assert/strict";
import test from "node:test";
import { bulkReleaseInsanKuSyncSkip } from "../src/services/bulkInsanKuSyncService.js";

const matches = (row, where) => Object.entries(where).every(([key, value]) =>
  value && typeof value === "object" ? value.in.includes(row[key]) : row[key] === value);
function fixture() {
  const people = ["a", "b", "inactive", "non-slip", "deleted"].map((uuid) => ({
    uuid, is_active: uuid !== "inactive", is_slip_gaji_account: uuid !== "non-slip", deleted_at: uuid === "deleted" ? new Date() : null,
    is_skip_sync: true, is_gofitku_setup_pending: true, name: uuid, username: uuid,
  }));
  const placements = [
    { uuid: "a-active", uuid_insanku: "a", deleted_at: null, is_active: true, is_skip_sync: true },
    { uuid: "a-inactive", uuid_insanku: "a", deleted_at: null, is_active: false, is_skip_sync: true },
    { uuid: "a-deleted", uuid_insanku: "a", deleted_at: new Date(), is_skip_sync: true },
    { uuid: "b-active", uuid_insanku: "b", deleted_at: null, is_skip_sync: true },
  ];
  let fail = false;
  const database = { async $transaction(callback) {
    const before = structuredClone({ people, placements });
    try {
      return await callback({
        tbl_insanku: {
          findMany: async ({ where }) => people.filter((row) => matches(row, where)),
          updateMany: async ({ where, data }) => people.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data)),
        },
        tbl_outlet_insanku: { updateMany: async ({ where, data }) => {
          placements.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data));
          if (fail) throw new Error("Write failed");
        } },
      });
    } catch (error) { people.splice(0, people.length, ...before.people); placements.splice(0, placements.length, ...before.placements); throw error; }
  } };
  return { people, placements, database, setFail() { fail = true; } };
}

test("release identity changes only selected skip flags and preserves identity, setup and placements", async () => {
  const f = fixture();
  const placements = structuredClone(f.placements);
  const result = await bulkReleaseInsanKuSyncSkip(f.database, { action: "bulk_release_identity_sync", uuid_insanku: ["a", "a"] });
  assert.equal(result.updated_count, 1);
  assert.equal(f.people[0].is_skip_sync, false);
  assert.equal(f.people[1].is_skip_sync, true);
  assert.equal(f.people[0].name, "a");
  assert.equal(f.people[0].username, "a");
  assert.equal(f.people[0].is_gofitku_setup_pending, true);
  assert.deepEqual(f.placements, placements);
});

test("release placements clears all undeleted placements of selected people including inactive history", async () => {
  const f = fixture();
  const people = structuredClone(f.people);
  await bulkReleaseInsanKuSyncSkip(f.database, { action: "bulk_release_placement_sync", uuid_insanku: ["a"] });
  assert.deepEqual(f.placements.map((row) => row.is_skip_sync), [false, false, true, true]);
  assert.equal(f.placements[1].is_active, false);
  assert.deepEqual(f.people, people);
});

test("invalid inputs and unavailable accounts are rejected without partial writes", async () => {
  const f = fixture();
  const before = structuredClone(f.people);
  for (const payload of [
    { action: "invalid", uuid_insanku: ["a"] },
    { action: "bulk_release_identity_sync", uuid_insanku: [] },
    ...["inactive", "non-slip", "deleted", "unknown"].map((uuid) => ({ action: "bulk_release_identity_sync", uuid_insanku: ["a", uuid] })),
  ]) await assert.rejects(bulkReleaseInsanKuSyncSkip(f.database, payload));
  assert.deepEqual(f.people, before);
});

test("failed placement write rolls back all changes", async () => {
  const f = fixture();
  const before = structuredClone(f.placements);
  f.setFail();
  await assert.rejects(bulkReleaseInsanKuSyncSkip(f.database, { action: "bulk_release_placement_sync", uuid_insanku: ["a"] }), /Write failed/);
  assert.deepEqual(f.placements, before);
});
