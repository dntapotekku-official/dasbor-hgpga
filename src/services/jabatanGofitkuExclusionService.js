import { permanentGofitkuExclusionDates } from "../lib/gofitkuExclusion.js";
import { randomUUID } from "node:crypto";

export async function getJabatanGofitkuExclusions(database) {
  const rows = await database.tbl_jabatan_master.findMany({
    where: { deleted_at: null }, orderBy: { name: "asc" },
    select: { uuid: true, name: true, pengecualian_jabatan: { where: { deleted_at: null }, select: { uuid: true } } },
  });
  return rows.map(({ pengecualian_jabatan, ...row }) => ({ ...row, is_excluded: pengecualian_jabatan.length > 0 }));
}

export async function saveJabatanGofitkuExclusions(database, ids) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Daftar jabatan tidak valid.");
  }
  const selected = [...new Set(ids)];
  await database.$transaction(async (tx) => {
    // Serialize replacements so simultaneous saves cannot merge two selections.
    await tx.$queryRaw`SELECT uuid FROM tbl_jabatan_master ORDER BY uuid FOR UPDATE`;
    const count = await tx.tbl_jabatan_master.count({ where: { uuid: { in: selected }, deleted_at: null } });
    if (count !== selected.length) throw new Error("Ada jabatan yang tidak tersedia. Muat ulang daftar jabatan.");
    await tx.tbl_pengecualian_jabatan.updateMany({ where: { deleted_at: null }, data: { deleted_at: new Date() } });
    if (selected.length) await tx.tbl_pengecualian_jabatan.createMany({
      data: selected.map((uuid_jabatan_master) => ({ uuid: randomUUID(), uuid_jabatan_master })),
    });
  });
  return { success: true, message: "Pengecualian jabatan berhasil disimpan." };
}

export async function applyJabatanGofitkuExclusions(tx, syncedIds, activeAssignments = null) {
  if (!syncedIds.length) return 0;
  let candidateIds = [...new Set(syncedIds)];
  if (activeAssignments !== null) {
    const selected = await tx.tbl_pengecualian_jabatan.findMany({
      where: { deleted_at: null, jabatan_master: { deleted_at: null } }, select: { uuid_jabatan_master: true },
    });
    const selectedIds = new Set(selected.map((item) => item.uuid_jabatan_master));
    const matchingPeople = new Set(activeAssignments.filter((item) => selectedIds.has(item.uuid_jabatan_master)).map((item) => item.uuid_insanku));
    candidateIds = candidateIds.filter((uuid) => matchingPeople.has(uuid));
    if (!candidateIds.length) return 0;
  }
  const people = await tx.tbl_insanku.findMany({
    where: {
      uuid: { in: candidateIds }, deleted_at: null, is_active: true, is_slip_gaji_account: true,
      ...(activeAssignments === null ? { outlet_insanku: { some: {
        deleted_at: null, is_active: true,
        jabatan_insanku: { some: { deleted_at: null, is_active: true,
          jabatan_master: { deleted_at: null, pengecualian_jabatan: { some: { deleted_at: null } } },
        } },
      } } } : {}),
    },
    select: { uuid: true }, orderBy: { uuid: "asc" },
  });
  let applied = 0;
  for (const person of people) {
    await tx.$queryRaw`SELECT uuid FROM tbl_insanku WHERE uuid = ${person.uuid} FOR UPDATE`;
    // Keep existing date values and avoid duplicate permanent exclusions.
    const existing = await tx.tbl_insanku_gofitku_exclusion.findFirst({
      where: { uuid_insanku: person.uuid, deleted_at: null },
      select: { uuid: true },
    });
    if (!existing) {
      await tx.tbl_insanku_gofitku_exclusion.create({ data: {
        uuid: randomUUID(), uuid_insanku: person.uuid, ...permanentGofitkuExclusionDates(),
      } });
      applied += 1;
    }
    await tx.tbl_insanku.update({ where: { uuid: person.uuid }, data: { is_gofitku_setup_pending: false } });
  }
  return applied;
}
