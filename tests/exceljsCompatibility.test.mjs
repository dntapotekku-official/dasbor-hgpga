import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

test("ExcelJS round-trips sales data and extended conditional formatting after dependency updates", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("GoFitKu");
  sheet.addRows([["InsanKU", "Tanggal", "Jumlah"], ["InsanKU Uji", new Date("2026-10-01T00:00:00Z"), 10]]);
  sheet.getCell("B2").numFmt = "dd/mm/yyyy";
  // Extended icon sets exercise the UUID dependency used by ExcelJS.
  sheet.addConditionalFormatting({ ref: "C2", rules: [{
    type: "iconSet", iconSet: "3Stars", cfvo: [
      { type: "num", value: 0 }, { type: "num", value: 5 }, { type: "num", value: 10 },
    ],
  }] });
  const data = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(data);
  const result = restored.getWorksheet("GoFitKu");
  assert.equal(result.getCell("A2").value, "InsanKU Uji");
  assert.equal(result.getCell("B2").value.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(result.getCell("C2").value, 10);
  assert.equal(result.conditionalFormattings[0].rules[0].iconSet, "3Stars");
});
