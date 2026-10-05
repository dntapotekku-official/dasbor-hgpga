import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPenjualanGofitkuGroups,
  isGofitkuRelationAvailableInRange,
  isGofitkuRelationAvailableOnDate,
} from "../src/lib/penjualanGofitkuReport.js";

const date = (day) => new Date(`2026-10-${day}T00:00:00.000Z`);
const relation = (uuid, person, outlet = "outlet-a") => ({
  uuid,
  uuid_outlet: outlet,
  uuid_insanku: person,
  inactive_periods: [],
  outlet: { uuid: outlet, name: outlet, category: "APOTEK" },
  insanku: {
    uuid: person,
    name: person,
    inactive_periods: [],
    gofitku_exclusion_periods: [],
  },
});
const sale = (uuid, assignment, day, qty) => ({
  uuid,
  uuid_outlet_insanku: assignment.uuid,
  outlet_insanku: assignment,
  uuid_produk_gofitku: "product-a",
  name: "Produk A",
  date: date(day),
  qty,
});
const report = (active_relations, sales_rows, selected_date) =>
  buildPenjualanGofitkuGroups({
    active_relations,
    sales_rows,
    selected_date: date(selected_date),
    day_end: new Date(date(selected_date).getTime() + 86400000),
    week_start: date("04"),
    week_end: date("11"),
    month_start: date("01"),
    month_end: new Date("2026-11-01T00:00:00.000Z"),
    target_map: new Map(),
  });

test("active employee without sales remains visible with zero totals", () => {
  const active = relation("assignment-a", "Ani");
  const [group] = report([active], [], "05");

  assert.equal(group.rows.length, 1);
  assert.deepEqual(
    { name: group.rows[0].name, active: group.rows[0].is_active, total: group.rows[0].monthly_total },
    { name: "Ani", active: true, total: 0 },
  );
});

test("resigned employee appears by name on sale date, then only in historical totals", () => {
  const active = relation("assignment-a", "Ani");
  const resigned = relation("assignment-b", "Vera");
  const sales = [sale("sale-b", resigned, "04", 3)];
  const [sale_day] = report([active], sales, "04");

  assert.equal(sale_day.rows.find((row) => row.name === "Vera")?.today_input, 3);
  assert.equal(sale_day.detail_rows[0].name, "Vera");

  const [next_day] = report([active], sales, "05");
  assert.equal(next_day.rows.some((row) => row.name === "Vera"), false);
  assert.equal(next_day.detail_rows.length, 0);
  assert.equal(next_day.rows.find((row) => row.uuid === "archived:outlet-a")?.monthly_total, 3);
  assert.equal(next_day.rows.reduce((total, row) => total + row.monthly_total, 0), 3);
});

test("reactivated employee keeps old sales under their name without today's sale", () => {
  const returned = relation("assignment-b", "Vera");
  const [group] = report([returned], [sale("sale-b", returned, "04", 3)], "05");

  assert.equal(group.rows.length, 1);
  assert.equal(group.rows[0].is_active, true);
  assert.equal(group.rows[0].today_input, 0);
  assert.equal(group.rows[0].monthly_total, 3);
});

test("old outlet keeps historical sales after employee moves", () => {
  const previous = relation("assignment-old", "Vera", "outlet-a");
  const current = relation("assignment-new", "Vera", "outlet-b");
  const groups = report([current], [sale("sale-old", previous, "04", 2)], "05");
  const by_outlet = new Map(groups.map((group) => [group.uuid, group]));

  assert.equal(by_outlet.get("outlet-a").rows[0].monthly_total, 2);
  assert.equal(by_outlet.get("outlet-b").rows[0].monthly_total, 0);
  assert.equal(by_outlet.get("outlet-b").rows[0].is_active, true);
});

test("target follows outlet placement, not only employee uuid", () => {
  const previous = relation("assignment-old", "Vera", "outlet-a");
  const current = relation("assignment-new", "Vera", "outlet-b");
  const groups = buildPenjualanGofitkuGroups({
    active_relations: [previous, current],
    sales_rows: [],
    selected_date: date("05"),
    day_end: new Date(date("05").getTime() + 86400000),
    week_start: date("04"),
    week_end: date("11"),
    month_start: date("01"),
    month_end: new Date("2026-11-01T00:00:00.000Z"),
    target_map: new Map([
      ["assignment-old", 3],
      ["assignment-new", 7],
    ]),
  });

  assert.deepEqual(
    groups.flatMap((group) => group.rows.map((row) => row.target)).sort((a, b) => a - b),
    [3, 7],
  );
});

test("relation is unavailable during placement, employee, or GoFitKu exclusion periods", () => {
  const placement_inactive = relation("assignment-placement", "Ani");
  placement_inactive.inactive_periods = [
    { start_date: date("05"), end_date: date("06") },
  ];

  const employee_inactive = relation("assignment-employee", "Budi");
  employee_inactive.insanku.inactive_periods = [
    { start_date: date("05"), end_date: date("06") },
  ];

  const excluded = relation("assignment-excluded", "Cici");
  excluded.insanku.gofitku_exclusion_periods = [
    { start_date: date("05"), end_date: date("06") },
  ];

  assert.equal(isGofitkuRelationAvailableOnDate(placement_inactive, date("05")), false);
  assert.equal(isGofitkuRelationAvailableOnDate(employee_inactive, date("05")), false);
  assert.equal(isGofitkuRelationAvailableOnDate(excluded, date("05")), false);
  assert.equal(isGofitkuRelationAvailableOnDate(excluded, date("07")), true);
});

test("monthly export relation remains visible only when at least one day is available", () => {
  const partially_active = relation("assignment-partial", "Ani");
  partially_active.inactive_periods = [
    { start_date: date("01"), end_date: date("15") },
  ];

  const fully_inactive = relation("assignment-inactive", "Budi");
  fully_inactive.inactive_periods = [
    { start_date: date("01"), end_date: new Date("2026-10-31T00:00:00.000Z") },
  ];

  const month_start = date("01");
  const month_end = new Date("2026-11-01T00:00:00.000Z");

  assert.equal(
    isGofitkuRelationAvailableInRange(partially_active, month_start, month_end),
    true,
  );
  assert.equal(
    isGofitkuRelationAvailableInRange(fully_inactive, month_start, month_end),
    false,
  );
});
