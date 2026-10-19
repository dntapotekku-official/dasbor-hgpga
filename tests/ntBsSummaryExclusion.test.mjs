import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { comparePercentage } from "../src/lib/number.js";
import {
  applySummaryExclusions, prepareMetricSummaryRows, summaryTargetCount,
  parseExclusionRange, findExclusionConflict,
} from "../src/lib/ntBsSummaryExclusion.js";

const source = readFileSync(new URL("../src/services/nilaiTransaksiBasketSizeService.js", import.meta.url), "utf8");
const summarizeServer = new Function("prepareMetricSummaryRows", "summaryTargetCount", "comparePercentage",
  source.slice(source.indexOf("const exec_file"))
    .replace("const exec_file = promisify(execFile);", "")
    .replace(/^export /gm, "") + "\nreturn summarize_metric_rows;",
)(prepareMetricSummaryRows, summaryTargetCount, comparePercentage);
const clientSource = readFileSync(new URL("../src/app/(main)/nilai-transaksi-basket-size/page.jsx", import.meta.url), "utf8");
const summarizeClient = new Function("prepareMetricSummaryRows", "summaryTargetCount", "comparePercentage", "toNumber", "empty_metrics",
  clientSource.slice(clientSource.indexOf("function summarizeVisibleRows("), clientSource.indexOf("export default function NilaiTransaksiPage"))
    + "\nreturn summarizeVisibleRows;",
)(prepareMetricSummaryRows, summaryTargetCount, comparePercentage, (value) => Number(value ?? 0), {});

function outlet(uuid, revenue, visits, sku, target) {
  return {
    uuid, nt_target: target, bs_target: 2,
    nt_daily_total_revenue: revenue, nt_daily_kunjungan: visits,
    nt_current_month_total_revenue: revenue, nt_current_month_kunjungan: visits,
    nt_last_month_total_revenue: revenue, nt_last_month_kunjungan: visits,
    bs_daily_sku_qty: sku, bs_daily_kunjungan: visits,
    bs_current_month_sku_qty: sku, bs_current_month_kunjungan: visits,
    bs_last_month_sku_qty: sku, bs_last_month_kunjungan: visits,
    nt_growth: 100, nt_gap_growth: 0, bs_growth: 100, bs_gap_growth: 0,
  };
}
const rows = [outlet("existing", 1000, 10, 20, 100),
  ...["amed", "bantas", "pemaron"].map((id) => outlet(id, 2000, 10, 40, 200))];
const exclusions = ["amed", "bantas", "pemaron"].flatMap((uuid_outlet) =>
  ["nilai_transaksi", "basket_size"].map((metric) => ({ uuid_outlet, metric, start_date: "2026-09-01", end_date: "2026-09-30" })));

test("September: details remain while both summary numerators and denominators exclude three outlets", () => {
  const flagged = applySummaryExclusions(rows, exclusions, "2026-09-30", "2026-08-31");
  assert.equal(flagged.length, 4);
  assert.equal(flagged[1].nt_current_month_total_revenue, 2000);
  assert.equal(flagged[1].bs_current_month_sku_qty, 40);
  assert.equal(flagged[1].nt_growth, 100);
  const result = summarizeServer(flagged);
  assert.equal(result.nt_current_month_total_revenue, 1000);
  assert.equal(result.nt_current_month_kunjungan, 10);
  assert.equal(result.nt_current_month, 100);
  assert.equal(result.nt_daily, 100);
  assert.equal(result.bs_current_month, 2);
  assert.equal(result.nt_target, 100);
  assert.equal(result.nt_last_month_total_revenue, 1000, "comparison uses the same eligible outlets as the selected report");
  assert.equal(result.nt_last_month_kunjungan, 10);
  assert.equal(rows[1].summary_exclusions, undefined, "source data is not mutated");
});

test("October: expired September exclusion no longer removes outlets from September comparison", () => {
  const flagged = applySummaryExclusions(rows, exclusions, "2026-10-12", "2026-09-30");
  const result = summarizeServer(flagged);
  assert.equal(result.nt_last_month, 175);
  assert.equal(result.bs_last_month, 3.5);
  assert.equal(result.nt_current_month, 175);
  assert.equal(result.bs_current_month, 3.5);
  assert.equal(result.nt_growth, 100);
  assert.equal(result.bs_growth, 100);
  assert.equal(result.nt_target, 175);
  assert.equal(result.nt_gap_growth, 0);
});

test("each exclusion applies to both NT and BS; unrelated months remain unchanged", () => {
  const flagged = applySummaryExclusions(rows, exclusions.filter((item) => item.metric === "nilai_transaksi"), "2026-09-30", "2026-08-31");
  const result = summarizeServer(flagged);
  assert.equal(result.nt_current_month, 100);
  assert.equal(result.bs_current_month, 2);
  const november = summarizeServer(applySummaryExclusions(rows, exclusions, "2026-11-12", "2026-10-31"));
  assert.equal(november.nt_current_month, 175);
  assert.equal(november.nt_last_month, 175);
  const global = summarizeServer(flagged, { nilai_transaksi: 150, basket_size: 3 });
  assert.equal(global.nt_target, 150, "explicit global targets remain configured values");
});

test("client totals and server/export/API summaries agree, including single-outlet and all-excluded views", () => {
  for (const current of ["2026-09", "2026-10"]) {
    const flagged = applySummaryExclusions(rows, exclusions, `${current}-30`, current === "2026-09" ? "2026-08-31" : "2026-09-30");
    for (const subset of [flagged, flagged.slice(1), flagged.slice(1, 2)]) {
      const server = summarizeServer(subset);
      const client = summarizeClient(subset);
      for (const key of ["nt_target", "bs_target", "nt_current_month", "nt_last_month", "bs_current_month", "bs_last_month", "nt_growth", "bs_growth"]) {
        assert.equal(client[key], server[key], key);
        assert.ok(Number.isFinite(server[key]), key);
      }
    }
  }
});

test("range validation rejects invalid dates and reversed periods", () => {
  assert.equal(parseExclusionRange("2026-09-01", "2026-09-30").end_date.toISOString().slice(0, 10), "2026-09-30");
  for (const pair of [["", "2026-09-30"], ["2026-02-30", "2026-03-01"], ["2026-09-30", "2026-09-01"], ["2026-9-01", "2026-09-30"]]) {
    assert.throws(() => parseExclusionRange(...pair));
  }
});

const candidate = (start_date, end_date, metrics = ["nilai_transaksi"], outlet_uuids = ["amed"]) => ({ start_date, end_date, metrics, outlet_uuids });
test("overlap validation covers exact, contained, containing, partial and touching intervals", () => {
  for (const [start, end] of [["2026-09-01", "2026-09-30"], ["2026-09-10", "2026-09-20"], ["2026-08-01", "2026-10-01"], ["2026-08-15", "2026-09-10"], ["2026-09-25", "2026-10-10"], ["2026-08-15", "2026-09-01"], ["2026-09-30", "2026-10-10"]]) {
    assert.ok(findExclusionConflict(exclusions, candidate(start, end)), `${start} - ${end}`);
  }
});

test("adjacent dates, other outlets and removed exclusions do not conflict", () => {
  assert.equal(findExclusionConflict(exclusions, candidate("2026-10-01", "2026-10-31")), undefined);
  assert.equal(findExclusionConflict(exclusions, candidate("2026-08-01", "2026-08-31")), undefined);
  assert.equal(findExclusionConflict(exclusions, candidate("2026-09-01", "2026-09-30", ["nilai_transaksi"], ["other"])), undefined);
  assert.ok(findExclusionConflict(exclusions.filter((item) => item.metric === "nilai_transaksi"), candidate("2026-09-01", "2026-09-30", ["basket_size"])), "legacy single-metric rows also block overlap for both metrics");
  assert.equal(findExclusionConflict(exclusions.map((item) => ({ ...item, deleted_at: new Date() })), candidate("2026-09-01", "2026-09-30")), undefined);
});

test("custom date ranges follow the reporting cutoff inclusively and leave other dates unchanged", () => {
  const range = [{ uuid_outlet: "amed", metric: "nilai_transaksi", start_date: "2026-09-10", end_date: "2026-09-20" }];
  for (const [date, excluded] of [["2026-09-09", false], ["2026-09-10", true], ["2026-09-15", true], ["2026-09-20", true], ["2026-09-21", false]]) {
    const flagged = applySummaryExclusions(rows, range, date, "2026-08-31");
    assert.equal(flagged[1].summary_exclusions.nilai_transaksi.current, excluded);
    assert.equal(flagged[1].summary_exclusions.basket_size.current, excluded);
    assert.equal(flagged[1].summary_exclusions.nilai_transaksi.previous, excluded);
  }
});
