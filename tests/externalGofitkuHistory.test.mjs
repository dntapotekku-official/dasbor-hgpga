import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isGofitkuExcluded } from "../src/lib/gofitkuExclusion.js";
import { buildPenjualanGofitkuGroups, isGofitkuRelationAvailableInRange, isGofitkuRelationAvailableOnDate } from "../src/lib/penjualanGofitkuReport.js";

const source = readFileSync(new URL("../src/services/penjualanGofitkuService.js", import.meta.url), "utf8");
export function loadExternalGofitku(prisma) {
  return new Function("prisma", "isGofitkuExcluded", "buildPenjualanGofitkuGroups", "isGofitkuRelationAvailableInRange", "isGofitkuRelationAvailableOnDate",
    source.slice(source.indexOf("function get_date_boundaries("), source.indexOf("export async function getPenjualanGofitkuExport(")).replace(/^export /gm, "") + "\nreturn {getExternalPenjualanGofitku, getExternalPenjualanGofitkuDetail, getExternalPenjualanGofitkuProduk, getPenjualanGofitku};")(
      prisma, isGofitkuExcluded, buildPenjualanGofitkuGroups, isGofitkuRelationAvailableInRange, isGofitkuRelationAvailableOnDate,
    );
}
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] == null;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(row[key]);
      if ("gte" in value || "lt" in value) return (!value.gte || row[key] >= value.gte) && (!value.lt || row[key] < value.lt);
      return row[key] != null && matches(row[key], value);
    }
    return row[key] === value;
  });
}
function fixture() {
  const outlet = { uuid: "amed", name: "APOTEKKU AMED", deleted_at: null, is_active: true, is_excluded: false };
  const placements = Array.from({ length: 4 }, (_, index) => ({
    uuid: `placement-${index}`, uuid_outlet: outlet.uuid, uuid_insanku: `person-${index}`, deleted_at: null,
    is_active: index !== 3, inactive_periods: index === 3 ? [{ start_date: new Date("2026-11-05"), end_date: null }] : [], outlet,
    insanku: { name: index === 3 ? "Baiq" : `Person ${index}`, deleted_at: null, is_active: index !== 2,
      inactive_periods: index === 2 ? [{ start_date: new Date("2026-11-05"), end_date: null }] : [], gofitku_exclusion_periods: [] },
  }));
  const excluded = structuredClone(placements[0]); excluded.uuid = "excluded"; excluded.insanku.gofitku_exclusion_periods = [{ start_date: new Date("1970-01-01"), end_date: null }];
  const inactive = structuredClone(placements[0]); inactive.uuid = "inactive"; inactive.inactive_periods = [{ start_date: new Date("2026-10-01"), end_date: null }];
  placements.push(excluded, inactive);
  const sale = (p, qty = 12) => ({ uuid_outlet_insanku: p.uuid, outlet_insanku: p, date: new Date("2026-10-03"), qty, deleted_at: null, name: "Product", uuid_produk_gofitku: "product" });
  const sales = placements.map((p) => sale(p, p.uuid === "excluded" || p.uuid === "inactive" ? 99 : 12));
  sales.push({ ...sale(placements[0], 99), deleted_at: new Date() });
  sales.push({ ...sale(placements[3], 99), date: new Date("2026-11-05") });
  const prisma = {
    tbl_outlet: { findFirst: async ({ where }) => matches(outlet, where) ? outlet : null },
    tbl_outlet_insanku: { findMany: async ({ where }) => placements.filter((p) => matches(p, where)) },
    tbl_penjualan_gofitku: { findMany: async ({ where }) => sales.filter((s) => matches(s, where)) },
    tbl_produk_gofitku: { findMany: async () => [{ uuid: "product", name: "Product" }] },
  };
  return loadExternalGofitku(prisma);
}

test("external monthly employee totals preserve October sales after placement or employee deactivation in November", async () => {
  const service = fixture();
  const data = await service.getExternalPenjualanGofitku({ uuid_outlet: "amed", tanggal: "2026-10" });
  assert.equal(data[0].insanku.reduce((sum, p) => sum + p.total, 0), 48);
  assert.equal(data[0].insanku.find((p) => p.nama === "Baiq").total, 12);
});

test("external daily and product totals use the same historical activity rules", async () => {
  const service = fixture();
  const detail = await service.getExternalPenjualanGofitkuDetail({ uuid_outlet: "amed", date: "2026-10" });
  assert.equal(detail.length, 31);
  assert.equal(detail.reduce((sum, day) => sum + day.qty, 0), 48);
  assert.equal(detail[2].qty, 48);
  const products = await service.getExternalPenjualanGofitkuProduk({ uuid_outlet: "amed", date: "2026-10" });
  assert.equal(products[0].total, 48);
  const november = await service.getExternalPenjualanGofitkuDetail({ uuid_outlet: "amed", date: "2026-11-05" });
  assert.equal(november[0].qty, 0);
});
