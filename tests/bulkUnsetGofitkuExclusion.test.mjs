import assert from "node:assert/strict";
import test from "node:test";
import { bulkUnsetGofitkuExclusion } from "../src/services/bulkGofitkuExclusionService.js";

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] == null;
    if (typeof value !== "object") return row[key] === value;
    if ("in" in value) return value.in.includes(row[key]);
    if ("some" in value) return row[key].some((item) => matches(item, value.some));
    return matches(row[key], value);
  });
}

function fixture() {
  const assignment = () => ({ deleted_at: null, is_active: true,
    jabatan_insanku: [{ deleted_at: null, is_active: true, jabatan_master: {
      deleted_at: null, pengecualian_jabatan: [{ deleted_at: null }],
    } }],
  });
  let state = {
    people: ["manual", "jabatan", "inactive-job", "inactive-placement", "deleted-job", "inactive", "non-slip", "deleted", "other"].map((uuid) => ({
      uuid, deleted_at: uuid === "deleted" ? new Date() : null,
      is_active: uuid !== "inactive", is_slip_gaji_account: uuid !== "non-slip",
      is_gofitku_setup_pending: false, created_at: new Date("2020-01-01"),
      outlet_insanku: uuid === "manual" ? [] : [assignment()],
    })),
    exclusions: ["manual", "jabatan", "inactive-job", "inactive-placement", "deleted-job", "inactive", "non-slip", "deleted", "other"].map((uuid_insanku) => ({ uuid_insanku, deleted_at: null })),
  };
  state.people.find((row) => row.uuid === "inactive-job").outlet_insanku[0].jabatan_insanku[0].is_active = false;
  state.people.find((row) => row.uuid === "inactive-placement").outlet_insanku[0].is_active = false;
  state.people.find((row) => row.uuid === "deleted-job").outlet_insanku[0].jabatan_insanku[0].jabatan_master.pengecualian_jabatan[0].deleted_at = new Date();
  let fail_write = false;
  const database = { async $transaction(callback) {
    const draft = structuredClone(state);
    const people = () => draft.people.map((row) => ({ ...row, gofitku_exclusion_periods: draft.exclusions.filter((item) => item.uuid_insanku === row.uuid) }));
    const result = await callback({
      tbl_insanku: {
        async updateMany({ where, data }) {
          const ids = people().filter((row) => matches(row, where)).map((row) => row.uuid);
          draft.people.filter((row) => ids.includes(row.uuid)).forEach((row) => Object.assign(row, data));
          return { count: ids.length };
        },
        async findMany({ where }) { return people().filter((row) => matches(row, where)); },
      },
      tbl_insanku_gofitku_exclusion: { async updateMany({ where, data }) {
        if (fail_write) throw new Error("Write failed");
        draft.exclusions.filter((row) => matches(row, where)).forEach((row) => Object.assign(row, data));
      } },
    });
    state = draft;
    return result;
  } };
  return { database, get state() { return state; }, set fail_write(value) { fail_write = value; } };
}
const payload = (ids, keep = true) => ({ uuid_insanku: ids, keep_jabatan_exclusion: keep });
const excluded = (f, uuid) => f.state.exclusions.some((row) => row.uuid_insanku === uuid && !row.deleted_at);

test("bulk unset retains only selected people with an active excluded position when checked", async () => {
  const f = fixture();
  const ids = ["manual", "jabatan", "inactive-job", "inactive-placement", "deleted-job", "inactive"];
  const result = await bulkUnsetGofitkuExclusion(f.database, payload(ids));
  assert.equal(result.updated_count, 5);
  assert.deepEqual(result.retained_ids, ["jabatan"]);
  for (const uuid of ids) assert.equal(excluded(f, uuid), uuid === "jabatan");
  assert.equal(excluded(f, "other"), true);
});

test("unchecked removes position exclusions too, without the seven-day restriction", async () => {
  const f = fixture();
  const result = await bulkUnsetGofitkuExclusion(f.database, payload(["manual", "jabatan", "manual"], false));
  assert.equal(result.updated_count, 2);
  assert.deepEqual(result.retained_ids, []);
  assert.equal(excluded(f, "manual"), false);
  assert.equal(excluded(f, "jabatan"), false);
  assert.equal(excluded(f, "other"), true);
});

test("invalid, stale or unsupported selections roll back the entire operation", async () => {
  for (const id of ["missing", "non-slip", "deleted"]) {
    const f = fixture();
    const before = structuredClone(f.state);
    await assert.rejects(bulkUnsetGofitkuExclusion(f.database, payload(["manual", id])), (error) => error.status === 409);
    assert.deepEqual(f.state, before);
  }
  const f = fixture();
  await bulkUnsetGofitkuExclusion(f.database, payload(["manual"], false));
  await assert.rejects(bulkUnsetGofitkuExclusion(f.database, payload(["manual"])), (error) => error.status === 409);
  for (const input of [payload([]), payload([null]), { uuid_insanku: ["jabatan"] }, payload(["jabatan"], "true")]) {
    await assert.rejects(bulkUnsetGofitkuExclusion(f.database, input));
  }
});

test("failed exclusion writes roll back the selected employees", async () => {
  const f = fixture();
  f.state.people[0].is_gofitku_setup_pending = true;
  const before = structuredClone(f.state);
  f.fail_write = true;
  await assert.rejects(bulkUnsetGofitkuExclusion(f.database, payload(["manual"], false)), /Write failed/);
  assert.deepEqual(f.state, before);
});
