import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyPlacementMonth, buildPlacementMapping, parseMappingYear } from "../src/lib/placementMapping.js";

const period = (start_date, end_date = null, deleted_at = null) => ({ start_date, end_date, deleted_at });
const placement = (uuid, name, start, end = null) => ({
  uuid, is_active: !end, created_at: "2026-10-26T06:00:00Z",
  outlet: { uuid: `outlet-${uuid}`, name },
  inactive_periods: [period("1970-01-01", start), ...(end ? [period(end)] : [])],
});
const employee = (placements, extra = {}) => ({
  uuid: "person", name: "InsanKU", nik: "123", is_active: true, is_slip_gaji_account: true,
  outlet_insanku: placements, inactive_periods: [], ...extra,
});
const mapping = (placements, extra = {}, year = 2026) => buildPlacementMapping([employee(placements, extra)], year).people[0];

test("effective October 1 before creation date appears from October, without inventing earlier history", () => {
  const person = mapping([placement("pekutatan", "Pekutatan", "2026-09-30")]);
  assert.equal(person.months[8].segments.length, 0);
  const october = person.months[9].segments[0];
  assert.equal(october.start_date, "2026-10-01");
  assert.equal(october.end_date, "2026-10-31");
  assert.equal(person.months[11].segments[0].start_date, "2026-12-01");
});

test("moving outlets mid-month shows both placements and excludes the deletion date", () => {
  const person = mapping([
    placement("selabih", "Selabih", "2026-09-30", "2026-10-15"),
    placement("pekutatan", "Pekutatan", "2026-10-14"),
  ]);
  assert.deepEqual(person.months[9].segments.map((row) => [row.outlet_name, row.start_date, row.end_date]), [
    ["Selabih", "2026-10-01", "2026-10-14"],
    ["Pekutatan", "2026-10-15", "2026-10-31"],
  ]);
  assert.equal(person.months[10].segments.length, 1);
});

test("delete and reactivate splits a month into periods and ignores soft-deleted inactivity", () => {
  const row = placement("a", "Outlet A", "2026-09-30");
  row.inactive_periods.push(period("2026-10-10", "2026-10-14"), period("2026-10-01", null, "2026-10-26"));
  const october = mapping([row]).months[9];
  assert.deepEqual(october.segments.map((segment) => [segment.start_date, segment.end_date]), [
    ["2026-10-01", "2026-10-09"], ["2026-10-15", "2026-10-31"],
  ]);
});

test("employee inactivity merges with overlapping placement inactivity", () => {
  const row = placement("a", "Outlet A", "2026-09-30");
  row.inactive_periods.push(period("2026-10-10", "2026-10-20"));
  const person = mapping([row], { inactive_periods: [period("2026-10-15", "2026-10-25")] });
  assert.deepEqual(person.months[9].segments.map((segment) => [segment.start_date, segment.end_date]), [
    ["2026-10-01", "2026-10-09"], ["2026-10-26", "2026-10-31"],
  ]);
});

test("simultaneous outlets remain visible as separate placements", () => {
  const person = mapping([placement("a", "Outlet A", "2026-09-30"), placement("b", "Outlet B", "2026-10-14")]);
});

test("legacy start uses row creation when there is no effective start history", () => {
  const row = { ...placement("a", "Outlet A", "2026-09-30"), created_at: "2026-10-12T12:00:00Z", inactive_periods: [] };
  const person = mapping([row]);
  assert.equal(person.months[8].segments.length, 0);
  assert.equal(person.months[9].segments[0].start_date, "2026-10-12");
});

test("inactive rows missing their end history are not displayed as active", () => {
  const row = { ...placement("a", "Outlet A", "2026-09-30"), is_active: false };
  const person = mapping([row]);
  assert.ok(person.months.every((month) => month.segments.length === 0));
});

test("leap years and year boundaries remain inclusive", () => {
  const row = placement("a", "Outlet A", "2023-12-31", "2024-03-01");
  const person = mapping([row], {}, 2024);
  assert.equal(person.months[0].segments[0].start_date, "2024-01-01");
  assert.equal(person.months[1].segments[0].end_date, "2024-02-29");
  assert.equal(person.months[2].segments.length, 0);
});

test("removed placement records are omitted and outlet choices remain unique", () => {
  const row = placement("a", "Outlet A", "2026-09-30");
  const data = buildPlacementMapping([employee([row, { ...row, uuid: "deleted", deleted_at: "2026-10-26" }])], 2026);
  assert.equal(data.outlets.length, 1);
  assert.equal(data.people[0].months[9].segments.length, 1);
});

test("year validation rejects incomplete and invalid input", () => {
  assert.equal(parseMappingYear("2026"), 2026);
  for (const year of [null, "", "wrong", 2026.1, 1899, 2201]) assert.throws(() => parseMappingYear(year), /Tahun harus/);
});

test("daily tables group people per outlet and preserve exact periods", () => {
  const outlet = placement("shared", "Pekutatan", "2026-09-30");
  const data = buildPlacementMapping([
    employee([outlet], { uuid: "person-a", name: "Ani" }),
    employee([{ ...outlet, uuid: "second-placement", inactive_periods: [period("1970-01-01", "2026-10-14")] }], { uuid: "person-b", name: "Budi" }),
  ], 2026);
  const before = JSON.stringify(data);
  const october = buildDailyPlacementMonth(data.people, 2026, 9);
  assert.equal(october.groups.length, 1);
  assert.equal(october.groups[0].name, "Pekutatan");
  assert.equal(october.person_count, 2);
  assert.deepEqual(october.groups[0].rows.map((row) => row.person_name), ["Ani", "Budi"]);
  assert.ok(october.groups[0].rows[0].days.every(Boolean));
  assert.ok(october.groups[0].rows[1].days.slice(0, 14).every((active) => !active));
  assert.ok(october.groups[0].rows[1].days.slice(14).every(Boolean));
  assert.equal(buildDailyPlacementMonth(data.people, 2026, 8).person_count, 0);
  assert.equal(JSON.stringify(data), before, "rendering does not mutate source data");
});

test("daily tables color only active dates, merging reactivation periods onto one row", () => {
  const row = placement("a", "Pekutatan", "2026-09-30");
  row.inactive_periods.push(period("2026-10-10", "2026-10-14"));
  const data = buildPlacementMapping([employee([row])], 2026);
  const october = buildDailyPlacementMonth(data.people, 2026, 9);
  assert.equal(october.total_days, 31);
  assert.equal(october.groups[0].rows.length, 1);
  assert.equal(october.person_count, 1);
  const days = october.groups[0].rows[0].days;
  assert.equal(days.length, 31);
  assert.equal(days[0], true);
  assert.equal(days[8], true);
  assert.equal(days[9], false);
  assert.equal(days[13], false);
  assert.equal(days[14], true);
  assert.equal(days[30], true);
});

test("daily tables respect outlet selection, month lengths and mid-month transfers", () => {
  const data = buildPlacementMapping([employee([
    placement("a", "Selabih", "2024-01-31", "2024-02-15"),
    placement("b", "Pekutatan", "2024-02-14"),
  ])], 2024);
  const february = buildDailyPlacementMonth(data.people, 2024, 1);
  assert.equal(february.total_days, 29);
  assert.equal(february.groups.length, 2);
  assert.equal(february.person_count, 1, "one employee on two outlets counts once");
  const selabih = buildDailyPlacementMonth(data.people, 2024, 1, "outlet-a");
  assert.equal(selabih.groups.length, 1);
  assert.equal(selabih.groups[0].name, "Selabih");
  assert.equal(selabih.groups[0].rows[0].days[13], true);
  assert.equal(selabih.groups[0].rows[0].days[14], false);
  const pekutatan = buildDailyPlacementMonth(data.people, 2024, 1, "outlet-b");
  assert.equal(pekutatan.groups[0].rows[0].days[13], false);
  assert.equal(pekutatan.groups[0].rows[0].days[14], true);
  assert.equal(buildDailyPlacementMonth(data.people, 2026, 1).total_days, 28);
  assert.equal(buildDailyPlacementMonth(data.people, 2024, 3).total_days, 30);
  assert.equal(buildDailyPlacementMonth(data.people, 2024, 1, "missing").groups.length, 0);
});

test("empty mappings and invalid months are handled without constructing invalid dates", () => {
  const data = buildPlacementMapping([employee([])], 2026);
  assert.deepEqual(buildDailyPlacementMonth(data.people, 2026, 9), { total_days: 31, groups: [], person_count: 0 });
  for (const month of [-1, 12, 0.5, NaN]) assert.throws(() => buildDailyPlacementMonth([], 2026, month), /Bulan harus/);
});
