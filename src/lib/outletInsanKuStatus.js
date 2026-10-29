export function isActiveJabatanRow(item) {
  return !Object.hasOwn(item, "active") || [1, "1", true].includes(item.active);
}

export function activeJabatanAssignments(payload) {
  const rows = Array.isArray(payload) ? payload : Object.values(payload ?? {}).flatMap((value) => Array.isArray(value) ? value : []);
  return rows.filter(isActiveJabatanRow).map((item) => ({
    uuid_outlet: String(item.cabangs_id ?? item.id_cabang ?? item.uuid_outlet ?? item.outlet_uuid ?? "").trim(),
    uuid_insanku: String(item.karyawans_id ?? item.id_karyawans ?? item.id_karyawan ?? item.uuid_insanku ?? "").trim(),
    uuid_jabatan_master: String(item.jabatans_id ?? item.id_jabatan ?? item.uuid_jabatan ?? item.jabatan_uuid ?? "").trim(),
  })).filter((item) => item.uuid_outlet && item.uuid_insanku && item.uuid_jabatan_master);
}

export function hasOutletInsanKuFlags(item) {
  return item != null && (Object.hasOwn(item, "ijin") || Object.hasOwn(item, "izin") || Object.hasOwn(item, "praktek"));
}

export function resolveOutletInsanKuStatus(izin, praktek) {
  const enabled = (value) => value === 1 || value === "1" || value === true;
  const hasIzin = enabled(izin);
  const hasPraktek = enabled(praktek);
  if (hasIzin && hasPraktek) return "izin_praktek";
  if (hasIzin) return "izin";
  if (hasPraktek) return "praktek";
  return null;
}

export function jabatanPlacementStatuses(payload) {
  const rows = Array.isArray(payload) ? payload : Object.values(payload ?? {}).flatMap((value) => Array.isArray(value) ? value : []);
  const statuses = new Map();
  for (const item of rows) {
    if (!hasOutletInsanKuFlags(item)) continue;
    if (!isActiveJabatanRow(item)) continue;
    const outlet = String(item.cabangs_id ?? item.id_cabang ?? item.uuid_outlet ?? item.outlet_uuid ?? "").trim();
    const employee = String(item.karyawans_id ?? item.id_karyawans ?? item.id_karyawan ?? item.uuid_insanku ?? "").trim();
    if (!outlet || !employee) continue;
    const key = `${outlet}:${employee}`;
    const current = resolveOutletInsanKuStatus(item.ijin ?? item.izin, item.praktek);
    const previous = statuses.get(key);
    // Multiple active positions on the same placement may grant each permission separately.
    statuses.set(key, resolveOutletInsanKuStatus(
      current === "izin" || current === "izin_praktek" || previous === "izin" || previous === "izin_praktek",
      current === "praktek" || current === "izin_praktek" || previous === "praktek" || previous === "izin_praktek",
    ));
  }
  return statuses;
}

export function outletInsanKuStatusLabel(status) {
  return { izin: "Izin", praktek: "Praktek", izin_praktek: "Izin & Praktek" }[status] ?? "";
}
