import assert from "node:assert/strict";
import test from "node:test";
import {
  closeOutletInsanKuInactivePeriod,
  isDateInInactivePeriods,
} from "../src/services/inactivePeriodService.js";

const date = (value) => new Date(`${value}T00:00:00.000Z`);

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((clause) => matches(row, clause));
    if (value && typeof value === "object") {
      return Object.entries(value).every(([op, boundary]) =>
        op === "gte" ? row[key] >= boundary : row[key] < boundary,
      );
    }
    return row[key] === value;
  });
}

test("backdating a reused placement trims its closed pre-active period", async () => {
  const rows = [
    { uuid_outlet_insanku: "pekutatan", start_date: date("1970-01-01"), end_date: date("2026-10-25"), deleted_at: null },
    { uuid_outlet_insanku: "pekutatan", start_date: date("2026-10-26"), end_date: null, deleted_at: null },
    { uuid_outlet_insanku: "other", start_date: date("1970-01-01"), end_date: date("2026-10-25"), deleted_at: null },
  ];
  const transaction = {
    tbl_outlet_insanku_inactive_period: {
      async updateMany({ where, data }) {
        const selected = rows.filter((row) => matches(row, where));
        for (const row of selected) Object.assign(row, data);
        return { count: selected.length };
      },
    },
  };
  await closeOutletInsanKuInactivePeriod(transaction, "pekutatan", date("2026-10-01"));
  const periods = rows.filter((row) => row.uuid_outlet_insanku === "pekutatan" && !row.deleted_at);
  assert.equal(periods[0].end_date.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(isDateInInactivePeriods(date("2026-09-30"), periods), true);
  assert.equal(isDateInInactivePeriods(date("2026-10-01"), periods), false);
  assert.equal(isDateInInactivePeriods(date("2026-10-26"), periods), false);
  assert.equal(rows[2].end_date.toISOString(), "2026-10-25T00:00:00.000Z");
  await closeOutletInsanKuInactivePeriod(transaction, "pekutatan", date("2026-10-01"));
  assert.equal(periods[0].end_date.toISOString(), "2026-09-30T00:00:00.000Z");
});

test("reactivation closes open periods and preserves earlier history and deleted rows", async () => {
  const rows = [
    { uuid_outlet_insanku: "placement", start_date: date("2026-08-01"), end_date: date("2026-08-15"), deleted_at: null },
    { uuid_outlet_insanku: "placement", start_date: date("2026-09-20"), end_date: null, deleted_at: null },
    { uuid_outlet_insanku: "placement", start_date: date("1970-01-01"), end_date: date("2026-10-25"), deleted_at: date("2026-10-26") },
  ];
  const transaction = {
    tbl_outlet_insanku_inactive_period: {
      async updateMany({ where, data }) {
        for (const row of rows.filter((row) => matches(row, where))) Object.assign(row, data);
      },
    },
  };
  await closeOutletInsanKuInactivePeriod(transaction, "placement", date("2026-10-01"));
  assert.equal(rows[0].end_date.toISOString(), "2026-08-15T00:00:00.000Z");
  assert.equal(rows[1].end_date.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(rows[2].end_date.toISOString(), "2026-10-25T00:00:00.000Z");
});
