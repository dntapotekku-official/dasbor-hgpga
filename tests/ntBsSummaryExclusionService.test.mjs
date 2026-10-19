import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseExclusionRange } from "../src/lib/ntBsSummaryExclusion.js";

const source = readFileSync(new URL("../src/services/ntBsSummaryExclusionService.js", import.meta.url), "utf8");
const load = new Function("prisma", "randomUUID", "parseExclusionRange",
  source.slice(source.indexOf("export async function")).replace(/^export /gm, "")
    + "\nreturn { getNtBsSummaryExclusions, saveNtBsSummaryExclusions, updateNtBsSummaryExclusion, removeNtBsSummaryExclusion };",
);

function fixture() {
  let rows = [];
  const events = [];
  const prisma = {
    async $transaction(callback) {
      const draft = structuredClone(rows);
      await callback({
        async $queryRaw(strings, uuid) { events.push(`lock:${uuid}`); },
        tbl_outlet: { count: async ({ where }) => where.uuid.in.length },
        tbl_nt_bs_summary_exclusion: {
          async findFirst({ where }) {
            events.push("check");
            if (where.uuid) return draft.find((item) => item.uuid === where.uuid && !item.deleted_at) ?? null;
            return draft.find((item) => !item.deleted_at
              && where.uuid_outlet.in.includes(item.uuid_outlet)
              && item.start_date <= where.start_date.lte && item.end_date >= where.end_date.gte) ?? null;
          },
          async updateMany({ where, data }) {
            for (const row of draft.filter((item) => item.uuid_outlet === where.uuid_outlet && item.start_date.getTime() === where.start_date.getTime() && item.end_date.getTime() === where.end_date.getTime() && !item.deleted_at)) Object.assign(row, data);
          },
          async create({ data }) {
            events.push("create");
            draft.push({ ...data, deleted_at: null, outlet: { name: data.uuid_outlet } });
          },
        },
      });
      rows = draft;
    },
    tbl_outlet: { findMany: async () => [] },
    tbl_nt_bs_summary_exclusion: {
      findMany: async () => rows.filter((row) => !row.deleted_at),
      findFirst: async ({ where }) => rows.find((row) => row.uuid === where.uuid && !row.deleted_at) ?? null,
      async updateMany({ where, data }) {
        for (const row of rows.filter((item) => item.uuid_outlet === where.uuid_outlet && item.start_date.getTime() === where.start_date.getTime() && item.end_date.getTime() === where.end_date.getTime() && !item.deleted_at)) Object.assign(row, data);
      },
    },
  };
  return { ...load(prisma, randomUUID, parseExclusionRange), get rows() { return rows; }, events };
}
const input = (start_date = "2026-09-01", end_date = "2026-09-30", outlet_uuids = ["amed"]) => ({ start_date, end_date, outlet_uuids });

test("server rejects intersecting ranges, including a shared boundary, without partial writes", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  for (const pair of [["2026-09-01", "2026-09-30"], ["2026-09-10", "2026-09-20"], ["2026-08-01", "2026-10-01"], ["2026-09-30", "2026-10-10"]]) {
    await assert.rejects(f.saveNtBsSummaryExclusions(input(...pair, ["amed", "bantas"])), (error) => error.status === 409 && /Rentang bertabrakan/.test(error.message));
    assert.equal(f.rows.length, 2);
  }
});

test("server automatically saves NT and BS and accepts adjacent dates or other outlets", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  await f.saveNtBsSummaryExclusions(input("2026-10-01", "2026-10-31"));
  await f.saveNtBsSummaryExclusions(input("2026-09-01", "2026-09-30", ["bantas"]));
  assert.equal(f.rows.length, 6);
  assert.deepEqual([...new Set(f.rows.map((row) => row.metric))].sort(), ["basket_size", "nilai_transaksi"]);
});

test("server locks outlets in stable order before checking and creating", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input("2026-09-01", "2026-09-30", ["pemaron", "amed", "bantas"]));
  assert.deepEqual(f.events.slice(0, 4), ["lock:amed", "lock:bantas", "lock:pemaron", "check"]);
  assert.equal(f.rows.length, 6);
});

test("removed range can be added again; invalid requests do not mutate data", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  await f.removeNtBsSummaryExclusion(f.rows[0].uuid);
  await f.saveNtBsSummaryExclusions(input());
  assert.equal(f.rows.filter((row) => !row.deleted_at).length, 2);
  for (const payload of [input("2026-09-30", "2026-09-01"), input("2026-02-30", "2026-09-01"), input("2026-09-01", "2026-09-30", [])]) {
    await assert.rejects(f.saveNtBsSummaryExclusions(payload));
  }
  assert.equal(f.rows.length, 4);
});


test("one table row represents both metrics and removing it clears both", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  const result = await f.getNtBsSummaryExclusions();
  assert.equal(result.exclusions.length, 1);
  assert.equal(result.exclusions[0].metric, undefined);
  await f.removeNtBsSummaryExclusion(result.exclusions[0].uuid);
  assert.equal(f.rows.filter((row) => !row.deleted_at).length, 0);
  assert.equal((await f.getNtBsSummaryExclusions()).exclusions.length, 0);
});

test("editing a range updates both metrics and permits keeping the same interval", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  await f.updateNtBsSummaryExclusion({ uuid: f.rows[0].uuid, ...input() });
  let active = f.rows.filter((row) => !row.deleted_at);
  assert.equal(active.length, 2);
  await f.updateNtBsSummaryExclusion({ uuid: active[0].uuid, ...input("2026-10-01", "2026-10-31", ["bantas"]) });
  active = f.rows.filter((row) => !row.deleted_at);
  assert.equal(active.length, 2);
  assert.ok(active.every((row) => row.uuid_outlet === "bantas" && row.start_date.toISOString().slice(0, 10) === "2026-10-01"));
  assert.equal((await f.getNtBsSummaryExclusions()).exclusions.length, 1);
});

test("editing into another range is rejected and restores the original pair", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  await f.saveNtBsSummaryExclusions(input("2026-10-01", "2026-10-31"));
  const before = structuredClone(f.rows);
  await assert.rejects(f.updateNtBsSummaryExclusion({ uuid: f.rows[0].uuid, ...input("2026-09-01", "2026-10-01") }), (error) => error.status === 409);
  assert.deepEqual(f.rows, before);
});

test("editing a stale or invalid selection leaves active exclusions unchanged", async () => {
  const f = fixture();
  await f.saveNtBsSummaryExclusions(input());
  const before = structuredClone(f.rows);
  await assert.rejects(f.updateNtBsSummaryExclusion({ uuid: "missing", ...input() }), /tidak ditemukan/);
  await assert.rejects(f.updateNtBsSummaryExclusion({ uuid: f.rows[0].uuid, ...input("2026-09-01", "2026-09-30", ["amed", "bantas"]) }), /satu outlet/);
  assert.deepEqual(f.rows, before);
});
