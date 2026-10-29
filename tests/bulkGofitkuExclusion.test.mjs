import assert from "node:assert/strict";
import test from "node:test";
import { bulkSetGofitkuExclusion, parseBulkGofitkuExclusion } from "../src/services/bulkGofitkuExclusionService.js";
import { getGofitkuSetupWindow, isWithinGofitkuSetupWindow } from "../src/lib/gofitkuSetupWindow.js";

const payload = (changes = {}) => ({
  uuid_insanku: ["new-a", "new-b"], is_exclude_penjualan_gofitku: true,
  gofitku_exclusion_start_date: "2026-10-01", gofitku_exclusion_end_date: "2026-10-31", ...changes,
});

function fixture() {
  let state = { people: ["new-a", "new-b", "new-c", "old", "non-slip", "inactive", "deleted"].map((uuid) => ({
    uuid, name: uuid, is_gofitku_setup_pending: uuid !== "old", is_active: uuid !== "inactive",
    is_slip_gaji_account: uuid !== "non-slip", deleted_at: uuid === "deleted" ? new Date() : null,
    created_at: new Date(),
  })), exclusions: [] };
  let failWrite = false;
  const prisma = { async $transaction(callback) {
    const draft = structuredClone(state);
    await callback({
      tbl_insanku: { async updateMany({ where, data }) {
        const selected = draft.people.filter((row) => where.uuid.in.includes(row.uuid)
          && !row.deleted_at && row.is_active && row.is_slip_gaji_account && row.is_gofitku_setup_pending
          && row.created_at >= where.created_at.gte && row.created_at <= where.created_at.lte);
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      } },
      tbl_insanku_gofitku_exclusion: { async createMany({ data }) {
        if (failWrite) throw new Error("Write failed");
        draft.exclusions.push(...data);
      } },
    });
    state = draft;
  } };
  return { prisma, get state() { return state; }, set failWrite(value) { failWrite = value; } };
}

test("bulk applies permanent exclusion only to selected new synced people within seven days", async () => {
  const f = fixture();
  f.state.people.find((row) => row.uuid === "new-a").created_at = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  f.state.people.find((row) => row.uuid === "new-b").created_at = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const result = await bulkSetGofitkuExclusion(f.prisma, payload());
  assert.equal(result.updated_count, 2);
  assert.deepEqual(f.state.exclusions.map((row) => row.uuid_insanku), ["new-a", "new-b"]);
  assert.ok(f.state.exclusions.every((row) => row.start_date.toISOString() === "1970-01-01T00:00:00.000Z" && row.end_date === null));
  assert.ok(f.state.people.filter((row) => ["new-a", "new-b"].includes(row.uuid)).every((row) => !row.is_gofitku_setup_pending));
  assert.equal(f.state.people.find((row) => row.uuid === "new-c").is_gofitku_setup_pending, true);
  assert.equal(f.state.people.find((row) => row.uuid === "new-a").name, "new-a");
});

test("open-ended exclusions and inclusion without exclusion are supported", async () => {
  const f = fixture();
  await bulkSetGofitkuExclusion(f.prisma, payload({ gofitku_exclusion_end_date: "" }));
  assert.ok(f.state.exclusions.every((row) => row.end_date === null));
  await bulkSetGofitkuExclusion(f.prisma, payload({ uuid_insanku: ["new-c"], is_exclude_penjualan_gofitku: false, gofitku_exclusion_start_date: "", gofitku_exclusion_end_date: "" }));
  assert.equal(f.state.exclusions.length, 2);
  assert.equal(f.state.people.find((row) => row.uuid === "new-c").is_gofitku_setup_pending, false);
});

test("stale selection, existing people, other account types, inactive/deleted people roll back the whole batch", async () => {
  for (const invalid of ["missing", "old", "non-slip", "inactive", "deleted"]) {
    const f = fixture();
    const before = structuredClone(f.state);
    await assert.rejects(bulkSetGofitkuExclusion(f.prisma, payload({ uuid_insanku: ["new-a", invalid] })), (error) => error.status === 409);
    assert.deepEqual(f.state, before);
  }
  const f = fixture();
  await bulkSetGofitkuExclusion(f.prisma, payload());
  await assert.rejects(bulkSetGofitkuExclusion(f.prisma, payload()), (error) => error.status === 409);
  assert.equal(f.state.exclusions.length, 2);
});

test("failed exclusion writes preserve the pending queue", async () => {
  const f = fixture();
  const before = structuredClone(f.state);
  f.failWrite = true;
  await assert.rejects(bulkSetGofitkuExclusion(f.prisma, payload()), /Write failed/);
  assert.deepEqual(f.state, before);
});

test("7-day window includes the boundary and rejects expired or future creation dates", async () => {
  const now = new Date("2026-10-19T04:00:00Z");
  const window = getGofitkuSetupWindow(now);
  assert.equal(isWithinGofitkuSetupWindow("2026-10-12T04:00:00Z", window), true);
  assert.equal(isWithinGofitkuSetupWindow(now, window), true);
  for (const date of ["2026-10-12T03:59:59.999Z", "2026-10-19T04:00:00.001Z", null, "invalid"]) {
    assert.equal(isWithinGofitkuSetupWindow(date, window), false);
  }
  const f = fixture();
  f.state.people.find((row) => row.uuid === "new-b").created_at = new Date(Date.now() - (7 * 24 + 1) * 60 * 60 * 1000);
  const before = structuredClone(f.state);
  await assert.rejects(bulkSetGofitkuExclusion(f.prisma, payload()), (error) => error.status === 409 && error.message.includes("7 hari"));
  assert.deepEqual(f.state, before);
});

test("validate selected names and boolean; deduplicate IDs; ignore retained date fields", () => {
  for (const changes of [
    { uuid_insanku: [] }, { uuid_insanku: [null] }, { is_exclude_penjualan_gofitku: "false" },
  ]) assert.throws(() => parseBulkGofitkuExclusion(payload(changes)));
  assert.equal(parseBulkGofitkuExclusion(payload({ uuid_insanku: ["new-a", "new-a"] })).ids.length, 1);
  for (const dates of [{}, { gofitku_exclusion_start_date: "", gofitku_exclusion_end_date: "" }, { gofitku_exclusion_start_date: "invalid", gofitku_exclusion_end_date: "2026-01-01" }]) {
    const result = parseBulkGofitkuExclusion({ uuid_insanku: ["new-a"], is_exclude_penjualan_gofitku: true, ...dates });
    assert.equal(result.start.toISOString(), "1970-01-01T00:00:00.000Z");
    assert.equal(result.end, null);
  }
});
