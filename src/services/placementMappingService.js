import { prisma } from "@/lib/prisma";
import { buildPlacementMapping, parseMappingYear } from "@/lib/placementMapping";

export async function getPlacementMapping(requested_year) {
  const year = parseMappingYear(requested_year);
  const period_select = { start_date: true, end_date: true };
  const people = await prisma.tbl_insanku.findMany({
    where: { deleted_at: null, role: "member" },
    orderBy: [{ name: "asc" }, { uuid: "asc" }],
    select: {
      uuid: true, name: true, nik: true, is_active: true, is_slip_gaji_account: true,
      inactive_periods: { where: { deleted_at: null }, select: period_select },
      outlet_insanku: {
        where: { deleted_at: null, outlet: { deleted_at: null } },
        select: {
          uuid: true, is_active: true, created_at: true,
          outlet: { select: { uuid: true, name: true } },
          inactive_periods: { where: { deleted_at: null }, select: period_select },
        },
      },
    },
  });
  return buildPlacementMapping(people, year);
}
