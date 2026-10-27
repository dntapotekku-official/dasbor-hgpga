import assert from "node:assert/strict";
import test from "node:test";
import { getJoinDateRangeDays } from "../src/lib/attributeJoinDateRange.js";
import { saveAttributeJoinDateRange } from "../src/services/attributeJoinDateRange.js";

test("join date ranges count both endpoints across months and leap years", () => {
  assert.equal(getJoinDateRangeDays("2026-01-01", "2026-01-01"), 1);
  assert.equal(getJoinDateRangeDays("2026-01-01", "2026-01-10"), 10);
  assert.equal(getJoinDateRangeDays("2024-02-28", "2024-03-01"), 3);
  assert.equal(getJoinDateRangeDays("2026-02-28", "2026-03-01"), 2);
  for (const [start, end] of [[null, "2026-01-01"], ["2026-01-01", ""], ["2026-02-30", "2026-03-01"], ["2026-03-02", "2026-03-01"]]) {
    assert.equal(getJoinDateRangeDays(start, end), null);
  }
});

test("checkbox survives repeated saves and disabling it preserves other attribute settings", async () => {
  const rows = [];
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const transaction = {
    tbl_rentang_tgl_atribut: {
      async findFirst({ where }) { return rows.find((row) => matches(row, where)); },
      async create({ data }) { rows.push({ ...data, deleted_at: null }); },
      async updateMany({ where, data }) {
        for (const row of rows.filter((row) => matches(row, where))) Object.assign(row, data);
      },
    },
  };
  await saveAttributeJoinDateRange(transaction, "attribute-a", true, "date");
  await saveAttributeJoinDateRange(transaction, "attribute-a", true, "date");
  await saveAttributeJoinDateRange(transaction, "attribute-b", true, "date");
  assert.equal(rows.length, 2);
  await saveAttributeJoinDateRange(transaction, "attribute-a", false, "date");
  assert.ok(rows[0].deleted_at instanceof Date);
  assert.equal(rows[1].deleted_at, null);
  await saveAttributeJoinDateRange(transaction, "attribute-a", true, "date");
  assert.equal(rows.filter((row) => row.uuid_kolom_atribut === "attribute-a" && row.deleted_at === null).length, 1);
  await assert.rejects(saveAttributeJoinDateRange(transaction, "attribute-a", true, "string"), /bertipe tanggal/);
});
