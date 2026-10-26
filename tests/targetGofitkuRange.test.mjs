import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/services/penjualanGofitkuService.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/app/(main)/pengaturan/target/components/target-management-card.jsx", import.meta.url), "utf8");

function service(database) {
  return new Function("prisma", "randomUUID",
    source.slice(source.indexOf("const invalid_excel_format_message"))
      .replace(/^export /gm, "") + `\nreturn {
        createTargetGofitku, updateTargetGofitku, bulkCreateTargetGofitku,
        bulkUpdateTargetGofitkuDates, bulkDeleteTargetGofitku, getTargetGofitku,
      };`,
  )(database, randomUUID);
}

function fixture() {
  const calls = [];
  const row = {
    uuid: "target-a", uuid_outlet_insanku: "placement-a", value: 10,
    start_date: new Date("2026-10-01T00:00:00Z"), end_date: null,
  };
  const database = {
    tbl_outlet_insanku: { findMany: async () => [{
      uuid: "placement-a", outlet: { uuid: "outlet-a", name: "Outlet A" },
      insanku: { uuid: "person-a", name: "Person A", nik: "123" },
    }] },
    tbl_target_gofitku: {
      findFirst: async (args) => { calls.push(["overlap", args]); return null; },
      findUnique: async () => row,
      findMany: async (args) => {
        calls.push(["findMany", args]);
        return args.where.uuid?.notIn ? [] : [row];
      },
      create: async ({ data }) => { calls.push(["create", data]); return data; },
      update: async ({ data }) => { calls.push(["update", data]); return { ...row, ...data }; },
      updateMany: async (args) => { calls.push(["updateMany", args]); return { count: 1 }; },
      createMany: async ({ data }) => { calls.push(["createMany", data]); return { count: data.length }; },
    },
    $transaction: async (fn) => fn(database),
  };
  return { api: service(database), calls };
}

const input = { uuid_outlet_insanku: "placement-a", target: 10, start_date: "2026-10-01", end_date: "" };

test("create and edit accept no end date and return it as unbounded", async () => {
  const { api, calls } = fixture();
  for (const result of [
    await api.createTargetGofitku(input),
    await api.updateTargetGofitku({ ...input, uuid_target_gofitku: "target-a" }),
  ]) {
    assert.equal(result.data.start_date, "2026-10-01");
    assert.equal(result.data.end_date, "");
  }
  assert.equal(calls.find(([method]) => method === "create")[1].end_date, null);
  assert.equal(calls.find(([method]) => method === "update")[1].end_date, null);
  for (const [, args] of calls.filter(([method]) => method === "overlap")) {
    assert.equal(args.where.start_date, undefined, "unbounded ranges must check future targets too");
  }
});

test("bounded periods stay inclusive and invalid periods are rejected", async () => {
  const { api, calls } = fixture();
  await api.createTargetGofitku({ ...input, end_date: "2026-10-01" });
  assert.equal(calls.find(([method]) => method === "overlap")[1].where.start_date.lte.toISOString(), "2026-10-01T00:00:00.000Z");
  await assert.rejects(api.createTargetGofitku({ ...input, end_date: "2026-09-30" }), /Tanggal akhir/);
  await assert.rejects(api.createTargetGofitku({ ...input, end_date: "2026-02-30" }), /tidak valid/);
  await assert.rejects(api.createTargetGofitku({ ...input, start_date: "" }), /wajib diisi/);
});

test("list preserves the empty end date of automatic placement targets", async () => {
  const { api } = fixture();
  const result = await api.getTargetGofitku();
  assert.equal(result.data_target_gofitku[0].end_date, "");
  assert.equal(result.data_target_gofitku[0].start_date, "2026-10-01");
});

test("bulk create, edit and delete support unbounded periods without matching one-day targets", async () => {
  const { api, calls } = fixture();
  await api.bulkCreateTargetGofitku(input);
  assert.equal(calls.find(([method]) => method === "createMany")[1][0].end_date, null);
  const payload = { ...input, source_start_date: "2026-10-01", source_end_date: "" };
  const result = await api.bulkUpdateTargetGofitkuDates(payload);
  assert.equal(result.data.end_date, "");
  await api.bulkDeleteTargetGofitku(payload);
  for (const [, args] of calls.filter(([method, args]) => method === "findMany" && args.where.start_date)) {
    assert.deepEqual(args.where.OR, [{ end_date: null }]);
  }
});

test("range filter includes overlapping targets and open-ended targets", () => {
  const filter = new Function("target_rows", "selected_date", "selected_end_date",
    "useMemo", "split_entity_filters", "selected_entity", "entity_key", "selected_outlet", "selected_insanku",
    client.slice(client.indexOf("  const filtered_items = useMemo("), client.indexOf("  const sorted_items = useMemo(")) + "\nreturn filtered_items;",
  );
  const rows = [
    { uuid: "ongoing", start_date: "2026-01-01", end_date: "" },
    { uuid: "past", start_date: "2026-09-01", end_date: "2026-09-30" },
    { uuid: "touch-start", start_date: "2026-09-01", end_date: "2026-10-01" },
    { uuid: "touch-end", start_date: "2026-10-31", end_date: "2026-11-01" },
    { uuid: "future", start_date: "2026-11-01", end_date: "" },
  ];
  const run = (start, end) => filter(rows, start, end, (fn) => fn(), false, "all", "uuid_outlet", "all", "all").map((row) => row.uuid);
  assert.deepEqual(run("2026-10-01", "2026-10-31"), ["ongoing", "touch-start", "touch-end"]);
  assert.deepEqual(run("2026-10-01", ""), ["ongoing", "touch-start", "touch-end", "future"]);
  assert.deepEqual(run("", "2026-09-30"), ["ongoing", "past", "touch-start"]);
  assert.equal(run("", "").length, rows.length);
});
