import assert from "node:assert/strict";
import test from "node:test";

import { softDeleteInsanKuRelations } from "../src/services/softDeleteInsanKuRelations.js";

test("deactivating InsanKu preserves sales and closes historical target/exclusion periods", async () => {
  const calls = [];
  const table = (name) => ({
    updateMany: async (args) => calls.push({ name, args }),
  });
  const transaction = {
    tbl_atribut_insanku: table("atribut"),
    tbl_target_gofitku: table("target"),
    tbl_insanku_gofitku_exclusion: table("exclusion"),
    tbl_nilai_magang: table("magang"),
    tbl_outlet_insanku: table("placement"),
    tbl_penjualan_gofitku: table("sales"),
  };
  const deleted_at = new Date("2026-10-05T00:00:00.000Z");

  await softDeleteInsanKuRelations(transaction, ["insanku-a"], deleted_at);

  assert.equal(calls.some((call) => call.name === "sales"), false);
  assert.equal(calls.find((call) => call.name === "placement")?.args.data.deleted_at, deleted_at);
  assert.equal(calls.find((call) => call.name === "target")?.args.data.end_date, deleted_at);
  assert.equal(calls.find((call) => call.name === "exclusion")?.args.data.end_date, deleted_at);
});
