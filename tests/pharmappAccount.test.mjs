import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/services/outletInsanKuService.js", import.meta.url), "utf8");
const normalize = new Function("dedupeByKey", source.slice(source.indexOf("function buildRelationKey("), source.indexOf("async function upsertJabatanInsanKu(")) + "\nreturn normalizeOutletInsanKuRows;")(
  (items, key) => [...new Map(items.map((item) => [key(item), item])).values()],
);
function rows(payload) {
  return normalize({ outlet_insanku_payload: payload, valid_outlet_uuid_set: new Set(["outlet"]), valid_insanku_uuid_set: new Set(["person"]) }).unique_rows;
}

test("cabang_karyawan akun_pharmapp is mapped and trimmed for flat and grouped payloads", () => {
  const person = { cabangs_id: "outlet", karyawans_id: "person", akun_pharmapp: " account-123 " };
  assert.equal(rows([person])[0].pharmapp_account, "account-123");
  assert.equal(rows({ outlet: [person] })[0].pharmapp_account, "account-123");
});

test("explicit empty accounts become null, while missing fields stay absent to preserve existing values", () => {
  for (const akun_pharmapp of [null, "", "  "]) {
    assert.equal(rows([{ cabangs_id: "outlet", karyawans_id: "person", akun_pharmapp }])[0].pharmapp_account, null);
  }
  assert.equal(Object.hasOwn(rows([{ cabangs_id: "outlet", karyawans_id: "person" }])[0], "pharmapp_account"), false);
});

test("the same PharmApp account is retained on distinct placements", () => {
  const result = normalize({
    outlet_insanku_payload: ["outlet-a", "outlet-b"].map((cabangs_id) => ({ cabangs_id, karyawans_id: "person", akun_pharmapp: "shared-account" })),
    valid_outlet_uuid_set: new Set(["outlet-a", "outlet-b"]), valid_insanku_uuid_set: new Set(["person"]),
  });
  assert.equal(result.unique_rows.length, 2);
  assert.deepEqual(result.unique_rows.map((row) => row.pharmapp_account), ["shared-account", "shared-account"]);
});
