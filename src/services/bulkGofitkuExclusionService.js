import { permanentGofitkuExclusionDates } from "../lib/gofitkuExclusion.js";
import { randomUUID } from "node:crypto";
import { getGofitkuSetupWindow } from "../lib/gofitkuSetupWindow.js";

export function parseBulkGofitkuExclusion(payload) {
  const ids = Array.isArray(payload?.uuid_insanku) ? [...new Set(payload.uuid_insanku)] : [];
  if (!ids.length || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Pilih minimal satu InsanKU.");
  }
  if (typeof payload.is_exclude_penjualan_gofitku !== "boolean") {
    throw new Error("Pengaturan pengecualian GoFitKu tidak valid.");
  }
  const enabled = payload.is_exclude_penjualan_gofitku;
  const { start_date: start, end_date: end } = permanentGofitkuExclusionDates();
  return { ids, enabled, start, end };
}

export async function bulkSetGofitkuExclusion(prisma, payload) {
  const { ids, enabled, start, end } = parseBulkGofitkuExclusion(payload);
  await prisma.$transaction(async (tx) => {
    // Claim the pending rows atomically; concurrent/stale requests cannot configure them twice.
    const result = await tx.tbl_insanku.updateMany({
      where: {
        uuid: { in: ids }, deleted_at: null, is_active: true,
        is_slip_gaji_account: true, is_gofitku_setup_pending: true,
        created_at: getGofitkuSetupWindow(),
      },
      data: { is_gofitku_setup_pending: false },
    });
    if (result.count !== ids.length) {
      const error = new Error("Ada InsanKU yang sudah diatur, tidak lagi aktif, atau melewati batas 7 hari sejak ditambahkan lewat sinkronisasi. Muat ulang daftar dan coba kembali.");
      error.status = 409;
      throw error;
    }
    if (enabled) {
      await tx.tbl_insanku_gofitku_exclusion.createMany({
        data: ids.map((uuid_insanku) => ({
          uuid: randomUUID(), uuid_insanku, start_date: start, end_date: end,
        })),
      });
    }
  }, { maxWait: 10_000, timeout: 30_000 });
  return { success: true, updated_count: ids.length, message: `Pengaturan GoFitKu untuk ${ids.length} InsanKU berhasil disimpan.` };
}

export async function bulkUnsetGofitkuExclusion(prisma, payload) {
  const { ids } = parseBulkGofitkuExclusion({ ...payload, is_exclude_penjualan_gofitku: false });
  if (typeof payload.keep_jabatan_exclusion !== "boolean") {
    throw new Error("Pengaturan pengecualian jabatan tidak valid.");
  }
  const retained_ids = await prisma.$transaction(async (tx) => {
    const result = await tx.tbl_insanku.updateMany({
      where: {
        uuid: { in: ids }, deleted_at: null, is_slip_gaji_account: true,
        gofitku_exclusion_periods: { some: { deleted_at: null } },
      },
      data: { is_gofitku_setup_pending: false },
    });
    if (result.count !== ids.length) {
      const error = new Error("Ada InsanKU yang tidak lagi dikecualikan atau tidak tersedia. Muat ulang daftar dan coba kembali.");
      error.status = 409;
      throw error;
    }
    const retained = payload.keep_jabatan_exclusion ? await tx.tbl_insanku.findMany({
      where: {
        uuid: { in: ids }, deleted_at: null, is_active: true, is_slip_gaji_account: true,
        outlet_insanku: { some: {
          deleted_at: null, is_active: true,
          jabatan_insanku: { some: {
            deleted_at: null, is_active: true,
            jabatan_master: { deleted_at: null, pengecualian_jabatan: { some: { deleted_at: null } } },
          } },
        } },
      },
      select: { uuid: true },
    }) : [];
    const retained_ids = retained.map((row) => row.uuid);
    const unset_ids = ids.filter((uuid) => !retained_ids.includes(uuid));
    if (unset_ids.length) {
      await tx.tbl_insanku_gofitku_exclusion.updateMany({
        where: { uuid_insanku: { in: unset_ids }, deleted_at: null },
        data: { deleted_at: new Date() },
      });
    }
    return retained_ids;
  }, { maxWait: 10_000, timeout: 30_000 });
  const updated_count = ids.length - retained_ids.length;
  return {
    success: true, updated_count, retained_ids,
    message: `Pengecualian ${updated_count} InsanKU berhasil dilepas. ${retained_ids.length} InsanKU tetap dikecualikan berdasarkan jabatan.`,
  };
}
