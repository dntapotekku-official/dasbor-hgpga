import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getGofitkuChartPeriod } from "../src/lib/gofitkuChartPeriod.js";

test("default chart period follows the current month in Makassar", () => {
  assert.equal(getGofitkuChartPeriod(null, new Date("2026-10-31T15:59:59Z")).month, "2026-10");
  assert.equal(getGofitkuChartPeriod(null, new Date("2026-10-31T16:00:00Z")).month, "2026-11");
  assert.equal(getGofitkuChartPeriod(null, new Date("2026-12-31T16:00:00Z")).month, "2027-01");
});

test("selected month includes its first day and excludes the next month", () => {
  const period = getGofitkuChartPeriod("2028-02");
  assert.equal(period.label, "Februari 2028");
  assert.equal(period.date_range.gte.toISOString(), "2028-02-01T00:00:00.000Z");
  assert.equal(period.date_range.lt.toISOString(), "2028-03-01T00:00:00.000Z");
  assert.equal(getGofitkuChartPeriod("2026-12").date_range.lt.toISOString(), "2027-01-01T00:00:00.000Z");
  for (const invalid of ["2026-00", "2026-13", "2026-1", "2026-01-01", "invalid"]) {
    assert.throws(() => getGofitkuChartPeriod(invalid));
  }
});

const source = readFileSync(new URL("../src/services/penjualanGofitkuService.js", import.meta.url), "utf8");
const chart_source = source.slice(source.indexOf("async function get_outlet_sales_totals"), source.indexOf("export async function createPenjualanGofitku"));
const load = new Function("prisma", "getGofitkuChartPeriod", "get_gofitku_chart_scope", "filter_sales_by_relation_periods", "build_top_outlet_chart", "build_top_product_chart",
  chart_source.replace(/^export /gm, "") + "\nreturn { getPenjualanGofitkuTopOutletChart, getPenjualanGofitkuTopProdukChart };",
);

test("both chart queries filter sales by selected month before summing", async () => {
  const rows = [
    { date: new Date("2026-09-30"), qty: 1000 },
    { date: new Date("2026-10-01"), qty: 2 },
    { date: new Date("2026-10-31"), qty: 3 },
    { date: new Date("2026-11-01"), qty: 2000 },
  ].map((row) => ({ ...row, uuid_outlet_insanku: "placement", name: "Produk" }));
  const scopes = [];
  const charts = load({ tbl_penjualan_gofitku: {
    async findMany({ where }) {
      assert.equal(where.deleted_at, null);
      assert.deepEqual(where.uuid_outlet_insanku.in, ["placement"]);
      return rows.filter((row) => row.date >= where.date.gte && row.date < where.date.lt);
    },
  } }, getGofitkuChartPeriod, async (context) => {
    scopes.push(context);
    return [{ uuid: "placement" }];
  }, (rows) => rows, (_, totals) => totals, (totals) => totals);

  const outlet = await charts.getPenjualanGofitkuTopOutletChart({ month: "2026-10" });
  const product = await charts.getPenjualanGofitkuTopProdukChart({ month: "2026-10", role: "member", account_uuid: "outlet" });
  assert.equal(outlet.chart_data[0]._sum.qty, 5);
  assert.equal(product.chart_data[0]._sum.qty, 5);
  assert.equal(scopes[1].account_uuid, "outlet");
  assert.equal(scopes[1].role, "member");
});
