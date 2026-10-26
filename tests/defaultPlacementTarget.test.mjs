import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDefaultPlacementTarget } from "../src/services/defaultPlacementTarget.js";

test("default target starts on the placement date and has no end date", () => {
  const start = new Date("2026-09-15T00:00:00.000Z");
  const target = buildDefaultPlacementTarget(start).create;
  assert.equal(target.value, 10);
  assert.equal(target.start_date, start);
  assert.equal(target.end_date, null);
});

test("missing placement date uses today's date in Makassar across the UTC day boundary", () => {
  for (const [now, expected] of [
    ["2026-10-25T15:59:59Z", "2026-10-25"],
    ["2026-10-25T16:00:00Z", "2026-10-26"],
  ]) {
    const target = buildDefaultPlacementTarget(null, new Date(now)).create;
    assert.equal(target.start_date.toISOString(), `${expected}T00:00:00.000Z`);
  }
});

test("creating an employee assigns a separate target to each new placement without a position", async () => {
  const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
  const placements = [];
  const transaction = {
    tbl_insanku: { create: async ({ data }) => data },
    tbl_outlet_insanku: { create: async ({ data }) => placements.push(data) },
  };
  const createEmployee = new Function(
    "prisma", "randomUUID", "normalizeNik", "normalizeOutletPlacements",
    "validateOutlets", "validateJabatanMaster", "savePlacementJabatan",
    "getInsanKuNonSlipGaji", "buildDefaultPlacementTarget", "parseOptionalDate",
    source.slice(
      source.indexOf("export async function createInsanKuNonSlipGaji("),
      source.indexOf("export async function updateInsanKuNonSlipGaji("),
    ).replace("export ", "") + "\nreturn createInsanKuNonSlipGaji;",
  )(
    { $transaction: (fn) => fn(transaction) }, randomUUID, (nik) => nik,
    (rows) => ({ placements: rows, outlet_uuids: rows.map((row) => row.outlet_uuid) }),
    async () => {}, async () => {}, async () => {},
    async () => ({ data_insanku: [] }), buildDefaultPlacementTarget,
    (value) => value ? new Date(`${value}T00:00:00.000Z`) : null,
  );
  await createEmployee({
    nik: "123", name: "InsanKU", username: "insanku",
    outlet_placements: [
      { outlet_uuid: "outlet-a", uuid_jabatan_master: "", active_start_date: "2026-10-01" },
      { outlet_uuid: "outlet-b", uuid_jabatan_master: "", active_start_date: "2026-10-20" },
    ],
  });
  assert.equal(placements.length, 2);
  assert.notEqual(placements[0].target_gofitku.create.uuid, placements[1].target_gofitku.create.uuid);
  for (const [index, day] of ["01", "20"].entries()) {
    assert.equal(placements[index].target_gofitku.create.value, 10);
    assert.equal(placements[index].target_gofitku.create.start_date.toISOString(), `2026-10-${day}T00:00:00.000Z`);
  }
});
