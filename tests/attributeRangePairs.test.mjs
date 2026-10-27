import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/services/atributInsanKuService.js", import.meta.url), "utf8");
const resolveRange = new Function(
  "normalize_attribute_type",
  source.slice(source.indexOf("async function resolve_range_with("), source.indexOf("function normalize_attribute_value_by_type(")) +
    "\nreturn resolve_range_with;",
)((value) => String(value ?? "").trim().toLowerCase());

function database(rows) {
  return { tbl_kolom_atribut: { findUnique: async ({ where }) => rows.find((row) => row.uuid === where.uuid) } };
}

test("A to B permits B to C and C to B while preventing B to A", async () => {
  const tx = database([
    { uuid: "a", type: "date", deleted_at: null, range_with: "b" },
    { uuid: "b", type: "date", deleted_at: null, range_with: null },
    { uuid: "c", type: "date", deleted_at: null, range_with: null },
  ]);
  assert.equal(await resolveRange(tx, { uuid: "b", type: "date", range_with: "c" }), "c");
  assert.equal(await resolveRange(tx, { uuid: "c", type: "date", range_with: "b" }), "b");
  assert.equal(await resolveRange(tx, { uuid: "a", type: "date", range_with: "b" }), "b");
  await assert.rejects(resolveRange(tx, { uuid: "b", type: "date", range_with: "a" }), /arah sebaliknya/);
});

test("range rules continue to reject self-pairs and invalid date columns", async () => {
  const tx = database([
    { uuid: "text", type: "string", deleted_at: null },
    { uuid: "deleted", type: "date", deleted_at: new Date() },
  ]);
  assert.equal(await resolveRange(tx, { uuid: "a", type: "date", range_with: "" }), null);
  await assert.rejects(resolveRange(tx, { uuid: "a", type: "date", range_with: "a" }), /dirinya sendiri/);
  for (const range_with of ["text", "deleted", "missing"]) {
    await assert.rejects(resolveRange(tx, { uuid: "a", type: "date", range_with }), /bertipe tanggal dan masih aktif/);
  }
});
