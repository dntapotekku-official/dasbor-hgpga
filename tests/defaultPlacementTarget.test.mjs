import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parsePlacementMonth, currentPlacementMonth } from "../src/lib/placementMonth.js";
import { buildDefaultPlacementTarget } from "../src/services/defaultPlacementTarget.js";

test("default target starts on January 1, 2026 and has no end date", () => {
  const target = buildDefaultPlacementTarget().create;
  assert.equal(target.value, 10);
  assert.equal(target.start_date.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(target.end_date, null);
});

test("creating an employee assigns a separate target to each new placement without a position", async () => {
  const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
  const placements = [];
  const starts = [];
  const transaction = {
    tbl_insanku: { create: async ({ data }) => data },
    tbl_outlet_insanku: { create: async ({ data }) => placements.push(data) },
  };
  const createEmployee = new Function(
    "prisma", "randomUUID", "normalizeNik", "normalizeOutletPlacements",
    "validateOutlets", "validateJabatanMaster", "savePlacementJabatan",
    "getInsanKuNonSlipGaji", "buildDefaultPlacementTarget", "parsePlacementMonth", "createOutletInsanKuPreActivePeriod", "currentPlacementMonth",
    source.slice(
      source.indexOf("export async function createInsanKuNonSlipGaji("),
      source.indexOf("export async function updateInsanKuNonSlipGaji("),
    ).replace("export ", "") + "\nreturn createInsanKuNonSlipGaji;",
  )(
    { $transaction: (fn) => fn(transaction) }, randomUUID, (nik) => nik,
    (rows) => ({ placements: rows, outlet_uuids: rows.map((row) => row.outlet_uuid) }),
    async () => {}, async () => {}, async () => {},
    async () => ({ data_insanku: [] }), buildDefaultPlacementTarget,
    parsePlacementMonth, async (_transaction, _uuid, start) => starts.push(start), currentPlacementMonth,
  );
  await createEmployee({
    nik: "123", name: "InsanKU", username: "insanku",
    outlet_placements: [
      { outlet_uuid: "outlet-a", uuid_jabatan_master: "", active_start_date: "2026-10" },
      { outlet_uuid: "outlet-b", uuid_jabatan_master: "", active_start_date: "2026-11" },
    ],
  });
  assert.equal(placements.length, 2);
  assert.deepEqual(starts.map((date) => date.toISOString()), ["2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"]);
  assert.notEqual(placements[0].target_gofitku.create.uuid, placements[1].target_gofitku.create.uuid);
  for (const placement of placements) {
    assert.equal(placement.target_gofitku.create.value, 10);
    assert.equal(placement.target_gofitku.create.start_date.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(placement.target_gofitku.create.end_date, null);
  }
});
