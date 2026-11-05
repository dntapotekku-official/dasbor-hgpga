/** Melepas pengaturan lewati sinkron untuk InsanKU terpilih secara atomik. */
export async function bulkReleaseInsanKuSyncSkip(prisma, payload) {
  const identity = payload?.action === "bulk_release_identity_sync";
  if (!identity && payload?.action !== "bulk_release_placement_sync") {
    throw new Error("Pengaturan sinkronisasi tidak valid.");
  }
  const ids = Array.isArray(payload.uuid_insanku) ? [...new Set(payload.uuid_insanku)] : [];
  if (!ids.length || ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Pilih minimal satu InsanKU.");
  }
  await prisma.$transaction(async (tx) => {
    const where = { uuid: { in: ids }, deleted_at: null, is_active: true, is_slip_gaji_account: true };
    const people = await tx.tbl_insanku.findMany({ where, select: { uuid: true } });
    if (people.length !== ids.length) {
      const error = new Error("Ada InsanKU yang tidak lagi tersedia. Muat ulang daftar dan coba kembali.");
      error.status = 409;
      throw error;
    }
    if (identity) {
      await tx.tbl_insanku.updateMany({ where, data: { is_skip_sync: false } });
    } else {
      await tx.tbl_outlet_insanku.updateMany({
        where: { uuid_insanku: { in: ids }, deleted_at: null },
        data: { is_skip_sync: false },
      });
    }
  });
  return {
    success: true, updated_count: ids.length,
    message: `Lewati ${identity ? "nama dan username" : "penempatan"} untuk ${ids.length} InsanKU berhasil dilepas. Perubahan dari Slip Gaji akan diterapkan saat sinkronisasi berikutnya.`,
  };
}
