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
  const parse = (value, label, required = false) => {
    if (!value && !required) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} wajib diisi dengan tanggal yang valid.`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} tidak valid.`);
    return date;
  };
  const start = enabled ? parse(payload.gofitku_exclusion_start_date, "Tanggal mulai pengecualian GoFitKu", true) : null;
  const end = enabled ? parse(payload.gofitku_exclusion_end_date, "Tanggal selesai pengecualian GoFitKu") : null;
  if (end && end < start) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
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
      const error = new Error("Ada InsanKU yang sudah diatur, tidak lagi aktif, atau melewati batas 48 jam sejak ditambahkan lewat sinkronisasi. Muat ulang daftar dan coba kembali.");
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
