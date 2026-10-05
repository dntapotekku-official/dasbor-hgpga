import assert from "node:assert/strict";
import test from "node:test";

import { softDeleteInsanKuRelations } from "../src/services/softDeleteInsanKuRelations.js";

test("manual delete cascades InsanKu relations with soft delete semantics", async () => {
  const calls = [];
  const table = (name) => ({
    updateMany: async (args) => calls.push({ name, args }),
    findMany: async () => [{ uuid: "placement-a" }],
  });
  const transaction = {
    tbl_atribut_insanku: table("atribut"),
    tbl_insanku_inactive_period: table("insanku_inactive_period"),
    tbl_target_gofitku: table("target"),
    tbl_insanku_gofitku_exclusion: table("exclusion"),
    tbl_nilai_magang: table("magang"),
    tbl_outlet_insanku: table("placement"),
    tbl_outlet_insanku_inactive_period: table("placement_inactive_period"),
    tbl_penjualan_gofitku: table("sales"),
  };
  const deleted_at = new Date("2026-10-05T00:00:00.000Z");

  await softDeleteInsanKuRelations(transaction, ["insanku-a"], deleted_at);

  assert.equal(calls.find((call) => call.name === "sales")?.args.data.deleted_at, deleted_at);
  assert.equal(calls.find((call) => call.name === "placement")?.args.data.deleted_at, deleted_at);
  assert.equal(calls.find((call) => call.name === "placement")?.args.data.uuid_insanku, null);
  assert.equal(calls.find((call) => call.name === "atribut")?.args.data.uuid_insanku, null);
  assert.equal(calls.find((call) => call.name === "target")?.args.data.uuid_outlet_insanku, null);
  assert.equal(calls.find((call) => call.name === "target")?.args.data.deleted_at, deleted_at);
  assert.equal(calls.find((call) => call.name === "exclusion")?.args.data.deleted_at, deleted_at);
  assert.equal(
    calls.find((call) => call.name === "insanku_inactive_period")?.args.data.deleted_at,
    deleted_at,
  );
  assert.equal(
    calls.find((call) => call.name === "placement_inactive_period")?.args.data.deleted_at,
    deleted_at,
  );
});
