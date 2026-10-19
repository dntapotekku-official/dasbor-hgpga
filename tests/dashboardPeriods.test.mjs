import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardPeriods } from "../src/lib/dashboardPeriods.js";

test("dashboard uses last month for satisfaction and yesterday for NT/BS", () => {
  const period = getDashboardPeriods(new Date("2026-10-19T04:00:00Z"));
  assert.equal(period.kepuasan_month, "2026-09");
  assert.equal(period.kepuasan_label, "September 2026");
  assert.equal(period.ntbs_date, "2026-10-18");
  assert.equal(period.ntbs_label, "18 Oktober 2026");
});

test("January rollover follows Makassar midnight even when UTC is still December", () => {
  const period = getDashboardPeriods(new Date("2026-12-31T16:00:00Z"));
  assert.equal(period.kepuasan_year, "2026");
  assert.equal(period.kepuasan_month, "2026-12");
  assert.equal(period.ntbs_date, "2026-12-31");
});

test("yesterday respects leap days and the local month boundary", () => {
  assert.equal(getDashboardPeriods(new Date("2028-02-29T16:00:00Z")).ntbs_date, "2028-02-29");
  const before = getDashboardPeriods(new Date("2026-10-31T15:59:59Z"));
  assert.equal(before.kepuasan_month, "2026-09");
  assert.equal(before.ntbs_date, "2026-10-30");
  const after = getDashboardPeriods(new Date("2026-10-31T16:00:00Z"));
  assert.equal(after.kepuasan_month, "2026-10");
  assert.equal(after.ntbs_date, "2026-10-31");
});
