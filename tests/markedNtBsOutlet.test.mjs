import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMarkedNtBsOutlets,
  refreshMarkedNtBsOutlets,
  withMarkedNtBsRefresh,
} from "../src/services/markedNtBsOutletService.js";

const date = (value) => new Date(`${value}T00:00:00.000Z`);
const row = (start, end, value, uuid_outlet = "outlet-a") => ({
  uuid_outlet, start_date: date(start), end_date: date(end), value,
});
const baseline = row("2026-09-01", "2026-09-30", 1000);
const baseline_visits = row("2026-09-01", "2026-09-30", 10);
const keys = (rows) => rows.map((row) => `${row.uuid_outlet}|${row.date.toISOString().slice(0, 10)}`);

test("day 7 fixes marks for dates 8 through month end despite subsequent growth", () => {
  const revenue = [baseline,
    row("2026-10-01", "2026-10-07", 800),
    row("2026-10-01", "2026-10-08", 800),
    row("2026-10-01", "2026-10-09", 1000),
    row("2026-10-01", "2026-10-10", 1200),
    row("2026-10-01", "2026-10-11", 999),
    row("2026-10-01", "2026-10-31", 900),
    row("2026-10-01", "2026-10-08", 0, "outlet-b"),
  ];
  const visits = [baseline_visits, ...revenue.slice(1).map((r) => ({ ...r, value: 10 }))];
  const marked = keys(calculateMarkedNtBsOutlets(revenue, visits));
  assert.ok(marked.includes("outlet-a|2026-10-08"));
  assert.ok(marked.includes("outlet-a|2026-10-31"));
  assert.ok(!marked.includes("outlet-a|2026-10-07"));
  for (const day of ["09", "10", "11"]) assert.ok(marked.includes(`outlet-a|2026-10-${day}`));
  assert.equal(marked.length, 24);
  assert.ok(!marked.some((key) => key.startsWith("outlet-b|")));
});

test("a full-month correction affects the following month, including leap years and January", () => {
  for (const [start, end, next] of [
    ["2024-01-01", "2024-01-31", "2024-02-29"],
    ["2026-12-01", "2026-12-31", "2027-01-31"],
  ]) {
    const next_start = `${next.slice(0, 7)}-01`;
    const next_seven = `${next.slice(0, 7)}-07`;
    const marked = keys(calculateMarkedNtBsOutlets(
      [row(start, end, 1000), row(next_start, next_seven, 800)],
      [row(start, end, 10), row(next_start, next_seven, 10)],
    ));
    assert.ok(marked.includes(`outlet-a|${next}`));
    assert.ok(!marked.some((key) => Number(key.slice(-2)) < 8));
  }
  assert.deepEqual(calculateMarkedNtBsOutlets([baseline], []), []);
});

test("day-7 NT equal to or above last month stays unmarked even if later NT declines", () => {
  for (const value of [999, 1000, 1100]) {
    const revenue = [baseline, row("2026-10-01", "2026-10-07", value), row("2026-10-01", "2026-10-08", 100)];
    const visits = [baseline_visits, ...revenue.slice(1).map((r) => ({ ...r, value: 10 }))];
    assert.deepEqual(calculateMarkedNtBsOutlets(revenue, visits), []);
  }
});

test("missing decision data does not mark outlets; daily NT on day 7 is not the monthly cutoff", () => {
  const decision = row("2026-10-01", "2026-10-07", 800);
  const decision_visits = { ...decision, value: 10 };
  for (const [revenue, visits] of [
    [[baseline], [baseline_visits, decision_visits]],
    [[baseline, decision], [baseline_visits]],
    [[decision], [decision_visits]],
    [[baseline, decision], [decision_visits]],
    [[baseline, { ...decision, start_date: date("2026-10-07") }], [baseline_visits, decision_visits]],
    [[baseline, decision], [baseline_visits, { ...decision_visits, value: 0 }]],
  ]) assert.deepEqual(calculateMarkedNtBsOutlets(revenue, visits), []);
  assert.equal(calculateMarkedNtBsOutlets(
    [baseline, { ...decision, value: 0 }], [baseline_visits, decision_visits],
  ).length, 24, "zero revenue with valid visits is a genuine decline");
});

function fixture() {
  const state = {
    revenue: [baseline, row("2026-10-01", "2026-10-07", 800)],
    visits: [baseline_visits, row("2026-10-01", "2026-10-07", 10)],
    marks: [], writes: 0,
  };
  const tx = {
    tbl_total_penerimaan_pendapatan: { findMany: async () => state.revenue },
    tbl_kunjungan: { findMany: async () => state.visits },
    tbl_marked_nt_bs_outlet: {
      findMany: async () => state.marks,
      createMany: async ({ data }) => {
        state.writes++;
        for (const item of data) state.marks.push({ ...item, id: state.marks.length + 1, deleted_at: null });
      },
      updateMany: async ({ where, data }) => {
        state.writes++;
        for (const item of state.marks) if (where.id.in.includes(item.id)) Object.assign(item, data);
      },
    },
  };
  return { state, database: { $transaction: async (fn) => fn(tx) } };
}

test("refresh is idempotent; declines can recover and be restored without duplicate rows", async () => {
  const { state, database } = fixture();
  await refreshMarkedNtBsOutlets(database);
  const original = state.marks.find((r) => r.date.getTime() === date("2026-10-08").getTime());
  assert.ok(original);
  const writes = state.writes;
  await refreshMarkedNtBsOutlets(database);
  assert.equal(state.writes, writes);
  state.revenue[1].value = 2000;
  await refreshMarkedNtBsOutlets(database);
  assert.ok(original.deleted_at);
  state.revenue[1].value = 800;
  await refreshMarkedNtBsOutlets(database);
  assert.equal(original.deleted_at, null);
  assert.equal(state.marks.filter((r) => r.date.getTime() === original.date.getTime()).length, 1);
  state.revenue.pop(); // Deleting only the day-7 NT removes all marks for October.
  await refreshMarkedNtBsOutlets(database);
  assert.ok(state.marks.every((r) => r.deleted_at));
});

test("write wrapper refreshes after success and preserves failed operations", async () => {
  const { state, database } = fixture();
  const mutate = withMarkedNtBsRefresh(database, async () => ({ success: true }));
  assert.deepEqual(await mutate(), { success: true });
  assert.ok(state.marks.length);
  const count = state.writes;
  const fail = withMarkedNtBsRefresh(database, async () => { throw new Error("mutation failed"); });
  await assert.rejects(fail(), /mutation failed/);
  assert.equal(state.writes, count);
});
