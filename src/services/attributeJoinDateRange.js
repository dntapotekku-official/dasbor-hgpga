import { randomUUID } from "node:crypto";

export async function saveAttributeJoinDateRange(transaction, uuid_kolom_atribut, enabled, type) {
  if (enabled && type !== "date") {
    throw new Error("Rentang Tanggal Bergabung hanya tersedia untuk kolom bertipe tanggal.");
  }

  const model = transaction.tbl_rentang_tgl_atribut;
  const where = { uuid_kolom_atribut, deleted_at: null };
  if (!enabled) {
    await model.updateMany({ where, data: { deleted_at: new Date() } });
    return;
  }

  const existing = await model.findFirst({ where, select: { uuid: true } });
  if (!existing) {
    await model.create({ data: { uuid: randomUUID(), uuid_kolom_atribut } });
  }
}
