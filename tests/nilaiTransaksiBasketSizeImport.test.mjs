import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Run the real import functions with an in-memory database and parser output.
const source = readFileSync(new URL("../src/services/nilaiTransaksiBasketSizeService.js", import.meta.url), "utf8");
const loadService = new Function(
  "prisma", "promisify", "execFile", "path", "process", "randomUUID",
  source.slice(source.indexOf("// ============================================================================"))
    .replace(/^export /gm, "")
    + "\nreturn { importNilaiTransaksiBulanan, importBasketSize };",
);
const date = (value) => new Date(`${value}T00:00:00.000Z`);
const models = ["tbl_total_penerimaan_pendapatan", "tbl_jumlah_sku", "tbl_kunjungan"];
const outlets = Array.from({ length: 90 }, (_, i) => ({
  uuid: `outlet-${i}`, name: `Outlet ${i}`, deleted_at: null, is_active: true, is_excluded: false,
}));

function matches(row, where) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === "not") return actual !== value;
        if (operator === "gte") return actual >= value;
        if (operator === "lte") return actual <= value;
        throw new Error(`Unsupported filter: ${operator}`);
      });
    }
    return actual === expected;
  });
}

function fixture() {
  let state = Object.fromEntries(models.map((model) => [model, []]));
  let payload = { rows: [] };
  let failWrites = false;
  let transactions = 0;
  const table = (store, model) => ({
    async updateMany({ where, data }) {
      for (const row of store[model].filter((row) => matches(row, where))) Object.assign(row, data);
    },
    async findFirst({ where }) {
      return store[model].find((row) => matches(row, where)) ?? null;
    },
    async update({ where, data }) {
      if (failWrites) throw new Error("Write failed");
      const row = store[model].find((row) => matches(row, where));
      Object.assign(row, data);
      return row;
    },
    async create({ data }) {
      if (failWrites) throw new Error("Write failed");
      const row = { deleted_at: null, ...data };
      store[model].push(row);
      return row;
    },
  });
  const prisma = {
    tbl_outlet: { findMany: async ({ where }) => outlets.filter((row) => matches(row, where)) },
    async $transaction(callback) {
      transactions++;
      const draft = structuredClone(state);
      const tx = Object.fromEntries(models.map((model) => [model, table(draft, model)]));
      await callback(tx);
      for (const model of models) {
        const keys = draft[model].map((row) => row.active_key).filter(Boolean);
        assert.equal(new Set(keys).size, keys.length, "active keys remain unique");
      }
      state = draft;
    },
  };
  const service = loadService(
    prisma, () => async () => ({ stdout: JSON.stringify(payload), stderr: "" }),
    () => {}, path, process, randomUUID,
  );
  return {
    get state() { return state; },
    get transactions() { return transactions; },
    set failWrites(value) { failWrites = value; },
    async import(metric, count, options = {}) {
      const { start = "2026-09-01", end = "2026-09-30", ...scope } = options;
      payload = { rows: outlets.slice(0, count).flatMap((outlet) => {
        const base = {
          outlet_name: outlet.name, total_penerimaan_pendapatan: 1000,
          kunjungan_nilai_transaksi: 10, sku_qty: 20, kunjungan_basket_size: 10,
        };
        return metric === "nilai_transaksi"
          ? [base]
          : [...new Set([start, end])].map((day) => ({ ...base, date: day }));
      }) };
      return metric === "nilai_transaksi"
        ? service.importNilaiTransaksiBulanan({ file_path: "test.xlsx", from_date: start, import_date: end, ...scope })
        : service.importBasketSize({ file_path: "test.xlsx", ...scope });
    },
  };
}

function active(rows, start = "2026-09-01", end = "2026-09-30") {
  return rows.filter((row) => !row.deleted_at
    && row.start_date.getTime() === date(start).getTime()
    && row.end_date.getTime() === date(end).getTime());
}

for (const [metric, model, otherMetric, otherModel] of [
  ["nilai_transaksi", "tbl_total_penerimaan_pendapatan", "basket_size", "tbl_jumlah_sku"],
  ["basket_size", "tbl_jumlah_sku", "nilai_transaksi", "tbl_total_penerimaan_pendapatan"],
]) {
  test(`${metric}: reimport 90 to 50 replaces the period and preserves other metrics/ranges`, async () => {
    const f = fixture();
    await f.import(metric, 90);
    await f.import(otherMetric, 90);
    await f.import(metric, 90, { start: "2026-10-01", end: "2026-10-19" });
    await f.import(metric, 90, { start: "2026-09-01", end: "2026-09-12" });
    const result = await f.import(metric, 50);
    assert.equal(result.data.imported_outlet_count, 50);
    assert.equal(active(f.state[model]).length, 50);
    assert.equal(active(f.state.tbl_kunjungan).filter((row) => row.metric === metric).length, 50);
    assert.equal(active(f.state[otherModel]).length, 90);
    assert.equal(active(f.state.tbl_kunjungan).filter((row) => row.metric === otherMetric).length, 90);
    assert.equal(active(f.state[model], "2026-10-01", "2026-10-19").length, 90);
    assert.equal(active(f.state[model], "2026-09-01", "2026-09-12").length, 90);
    assert.ok(f.state[model].filter((row) => row.deleted_at).every((row) => row.active_key === null));
    await f.import(metric, 50);
    assert.equal(active(f.state[model]).length, 50);
    await f.import(metric, 90);
    assert.equal(active(f.state[model]).length, 90, "previously omitted outlets can be reimported");
  });

  test(`${metric}: invalid import leaves existing data intact`, async () => {
    const f = fixture();
    await f.import(metric, 90);
    const before = structuredClone(f.state);
    const transactions = f.transactions;
    await assert.rejects(f.import(metric, 0), /Tidak ada data outlet/);
    assert.equal(f.transactions, transactions);
    assert.deepEqual(f.state, before);
  });

  test(`${metric}: failed writes roll back replacement`, async () => {
    const f = fixture();
    await f.import(metric, 90);
    const before = structuredClone(f.state);
    f.failWrites = true;
    await assert.rejects(f.import(metric, 50), /Write failed/);
    assert.deepEqual(f.state, before);
  });

  test(`${metric}: scoped import only replaces the specified outlet`, async () => {
    const f = fixture();
    await f.import(metric, 90);
    await f.import(metric, 1, { member_outlet_uuid: "outlet-0" });
    assert.equal(active(f.state[model]).length, 90);
    assert.equal(active(f.state.tbl_kunjungan).length, 90);
  });

  test(`${metric}: single-day replacement preserves monthly data`, async () => {
    const f = fixture();
    await f.import(metric, 90);
    await f.import(metric, 90, { start: "2026-09-19", end: "2026-09-19" });
    await f.import(metric, 50, { start: "2026-09-19", end: "2026-09-19" });
    assert.equal(active(f.state[model], "2026-09-19", "2026-09-19").length, 50);
    assert.equal(active(f.state[model]).length, 90);
  });
}
