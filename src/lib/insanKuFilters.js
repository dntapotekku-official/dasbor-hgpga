/** Mencocokkan nama, akun PharmApp, outlet, dan jabatan aktif pada penempatan yang sama. */
export function matchesInsanKuFilters(item, { search = "", outlet = "all", jabatan = "all" } = {}) {
  const placements = (item.outlet_placements ?? []).filter((placement) => {
    if (placement.is_active === false) return false;
    if (outlet !== "all" && placement.outlet_uuid !== outlet) return false;
    if (jabatan === "all") return true;
    const positions = placement.jabatan_list ?? [{ uuid_jabatan_master: placement.uuid_jabatan_master, is_active: placement.jabatan_is_active }];
    return positions.some((position) => position.is_active !== false && position.uuid_jabatan_master === jabatan);
  });
  if ((outlet !== "all" || jabatan !== "all") && !placements.length) return false;
  const keyword = search.trim().toLowerCase();
  return !keyword || String(item.name ?? "").toLowerCase().includes(keyword) ||
    placements.some((placement) => String(placement.pharmapp_account ?? "").toLowerCase().includes(keyword));
}
