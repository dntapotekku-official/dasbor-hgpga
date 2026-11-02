import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ExcelJS from "exceljs";

const source = readFileSync(new URL("../src/services/nilaiTransaksiBasketSizeService.js", import.meta.url), "utf8");
const config = source.slice(source.indexOf("const export_category_labels"), source.indexOf("// ============================================================================", source.indexOf("const export_columns")));
const labels = source.slice(source.indexOf("function resolve_export_period_label("), source.indexOf("/** Mengonversi nilai"));
const exporter = source.slice(source.indexOf('const export_font_name ='), source.indexOf("// ============================================================================", source.indexOf("export async function exportNilaiTransaksiBasketSizeWorkbook("))).replace(/^export /gm, "");

const metrics = { nt_target: 200, nt_daily: 180, nt_last_month: 100, nt_current_month: 150, nt_growth: 150, nt_gap_growth: 50, nt_target_compare: 75, nt_gap_target: -25,
  bs_target: 2, bs_last_month: 1, bs_current_month: 3, bs_growth: 300, bs_gap_growth: 200, bs_target_compare: 150, bs_gap_target: 50 };
const row = { ...metrics, uuid: "outlet", outlet_name: "Outlet A", category_key: "non-pariwisata", highlight_nt_decline: true };
const fixture = () => ({ rows: [{ ...row }], category_metrics: { "non-pariwisata": { ...metrics } }, overall_metrics: { ...metrics },
  selected_month_label: "Oktober 2026", selected_date_label: "29 Oktober 2026", previous_period_label: "September (1–30)", selected_period_label: "Oktober (1–29)", previous_month_label: "September" });
const exportWorkbook = new Function("ExcelJS", "getNilaiTransaksiBasketSize", "summarize_metric_rows", "outlet_category_slugs", "summaryExclusionLabel", "to_number", config + labels + exporter + "\nreturn exportNilaiTransaksiBasketSizeWorkbook;")(
  ExcelJS, async () => fixture(), () => ({ ...metrics }), ["non-pariwisata"], () => "", (value) => Number(value ?? 0),
);

for (const outlet_scope of ["all", "marked"]) {
  test(`Excel ${outlet_scope}: BS precedes NT with correct data, summary formulas and formats after saving`, async () => {
    const { buffer } = await exportWorkbook({ selected_date: "2026-10-29", outlet_scope });
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(buffer);
    const sheet = restored.worksheets[0];
    assert.equal(sheet.getCell("D2").value, "BASKET SIZE");
    assert.equal(sheet.getCell("K2").value, "NILAI TRANSAKSI");
    assert.ok(sheet.model.merges.includes("D2:J2"));
    assert.ok(sheet.model.merges.includes("K2:R2"));
    assert.equal(sheet.getCell("B5").value, "Outlet A");
    for (const number of [5, 6, 7]) {
      const r = sheet.getRow(number);
      for (const [column, value] of Object.entries({ D: 2, E: 1, F: 3, K: 200, L: 180, M: 100, N: 150 })) assert.equal(r.getCell(column).value, value);
      const formulas = {
        G: [`IF(E${number}=0,0,F${number}/E${number}*100)`, 300], H: [`G${number}-100`, 200],
        I: [`IF(D${number}=0,0,F${number}/D${number}*100)`, 150], J: [`I${number}-100`, 50],
        O: [`IF(M${number}=0,0,N${number}/M${number}*100)`, 150], P: [`O${number}-100`, 50],
        Q: [`IF(K${number}=0,0,N${number}/K${number}*100)`, 75], R: [`Q${number}-100`, -25],
      };
      for (const [column, [formula, result]] of Object.entries(formulas)) {
        assert.equal(r.getCell(column).formula, formula);
        assert.equal(r.getCell(column).result, result);
      }
      assert.equal(r.getCell("D").numFmt, "0.00");
      assert.equal(r.getCell("K").numFmt, '"Rp"* #,##0');
      assert.equal(r.getCell("R").fill.fgColor.argb, number === 6 ? "FFFFFF00" : "FFF4A09C");
    }
    assert.equal(sheet.getCell("F5").fill.fgColor.argb, "FFC6E0B4");
    assert.equal(sheet.getCell("L5").fill.fgColor.argb, "FFC6E0B4");
    if (outlet_scope === "marked") assert.equal(sheet.getCell("B5").fill.fgColor.argb, "FFFED7AA");
  });
}
