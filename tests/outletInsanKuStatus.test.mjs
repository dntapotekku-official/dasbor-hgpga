import assert from "node:assert/strict";
import test from "node:test";
import { jabatanPlacementStatuses, hasOutletInsanKuFlags, outletInsanKuStatusLabel, resolveOutletInsanKuStatus } from "../src/lib/outletInsanKuStatus.js";

test("izin and praktek map numeric, string and boolean flags to placement status", () => {
  for (const [izin, praktek, expected] of [[1, 0, "izin"], [0, 1, "praktek"], [1, 1, "izin_praktek"], [0, 0, null], ["1", "0", "izin"], ["0", "1", "praktek"], ["1", "1", "izin_praktek"], ["0", "0", null], [true, false, "izin"], [false, true, "praktek"], [false, false, null]]) {
    assert.equal(resolveOutletInsanKuStatus(izin, praktek), expected);
  }
});

test("jb-karyawan status uses ijin and praktek per employee/outlet, including grouped payloads", () => {
  const result = jabatanPlacementStatuses({ data: [
    { karyawans_id: "a", cabangs_id: "x", ijin: 1, praktek: 0, active: 1 },
    { karyawans_id: "a", cabangs_id: "y", ijin: 0, praktek: 1, active: 1 },
    { karyawans_id: "b", cabangs_id: "x", ijin: "1", praktek: "1", active: "1" },
    { karyawans_id: "c", cabangs_id: "x", ijin: 0, praktek: 0, active: 1 },
    { karyawans_id: "inactive", cabangs_id: "x", ijin: 1, praktek: 1, active: 0 },
    { karyawans_id: "missing", cabangs_id: "x", active: 1 },
    { ijin: 1, praktek: 1 },
  ] });
  assert.deepEqual([...result], [["x:a", "izin"], ["y:a", "praktek"], ["x:b", "izin_praktek"], ["x:c", null]]);
  assert.equal(hasOutletInsanKuFlags({ ijin: 0, praktek: 0 }), true);
  assert.equal(hasOutletInsanKuFlags({}), false);
  assert.equal(outletInsanKuStatusLabel("izin_praktek"), "Izin & Praktek");
  assert.equal(outletInsanKuStatusLabel(null), "");
});

test("multiple active jb-karyawan entries combine permissions without mixing other placements", () => {
  const result = jabatanPlacementStatuses([
    { karyawans_id: "a", cabangs_id: "x", ijin: 1, praktek: 0, active: 1 },
    { karyawans_id: "a", cabangs_id: "x", ijin: 0, praktek: 1, active: 1 },
    { karyawans_id: "a", cabangs_id: "x", ijin: 0, praktek: 0, active: 1 },
    { karyawans_id: "a", cabangs_id: "y", ijin: 1, praktek: 0, active: 1 },
    { karyawans_id: "a", cabangs_id: "y", ijin: 0, praktek: 1, active: 0 },
  ]);
  assert.equal(result.get("x:a"), "izin_praktek");
  assert.equal(result.get("y:a"), "izin");
});

test("inactive position history cannot overwrite the selected active position", async () => {
  const { readFileSync } = await import('node:fs');
  const { isActiveJabatanRow } = await import('../src/lib/outletInsanKuStatus.js');
  const source = readFileSync(new URL('../src/services/outletInsanKuService.js', import.meta.url), 'utf8');
  const mapper = new Function('isActiveJabatanRow', source.slice(source.indexOf('function buildRelationKey('), source.indexOf('function normalizeOutletInsanKuRows(')) + '\nreturn buildJabatanRelationMap;')(isActiveJabatanRow);
  const result = mapper([
    { cabangs_id: 'outlet', karyawans_id: 'person', jabatans_id: 'current', active: 1 },
    { cabangs_id: 'outlet', karyawans_id: 'person', jabatans_id: 'historical', active: 0 },
  ]);
  assert.equal(result.get('outlet:person').uuid_jabatan_master, 'current');
});
