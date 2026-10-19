import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseExclusionRange } from "@/lib/ntBsSummaryExclusion";

export async function getNtBsSummaryExclusions() {
  const [outlets, exclusions] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: { deleted_at: null, is_active: true, is_excluded: false },
      select: { uuid: true, name: true }, orderBy: { name: "asc" },
    }),
    prisma.tbl_nt_bs_summary_exclusion.findMany({
      where: { deleted_at: null, outlet: { deleted_at: null } },
      include: { outlet: { select: { name: true } } },
      orderBy: [{ start_date: "desc" }, { outlet: { name: "asc" } }],
    }),
  ]);
  const ranges = new Map();
  for (const item of exclusions) {
    const { metric: _metric, ...row } = item;
    row.start_date = item.start_date.toISOString().slice(0, 10);
    row.end_date = item.end_date.toISOString().slice(0, 10);
    const key = `${row.uuid_outlet}:${row.start_date}:${row.end_date}`;
    if (!ranges.has(key)) ranges.set(key, row);
  }
  return { outlets, exclusions: [...ranges.values()] };
}

async function writeNtBsSummaryExclusions({ outlet_uuids, start_date, end_date }, uuid = null) {
  const range = parseExclusionRange(start_date, end_date);
  const uuids = [...new Set(Array.isArray(outlet_uuids) ? outlet_uuids : [])];
  if (!uuids.length || uuids.some((uuid) => typeof uuid !== "string" || !uuid.trim())) {
    throw new Error("Pilih minimal satu outlet.");
  }
  const original = uuid ? await prisma.tbl_nt_bs_summary_exclusion.findFirst({ where: { uuid, deleted_at: null } }) : null;
  if (uuid && !original) throw new Error("Pengecualian tidak ditemukan. Muat ulang halaman.");
  await prisma.$transaction(async (tx) => {
    // Serialize changes for each outlet so simultaneous requests cannot create overlapping ranges.
    const lock_uuids = [...new Set([...uuids, ...(original ? [original.uuid_outlet] : [])])].sort();
    for (const outlet_uuid of lock_uuids) {
      await tx.$queryRaw`SELECT uuid FROM tbl_outlet WHERE uuid = ${outlet_uuid} FOR UPDATE`;
    }
    const count = await tx.tbl_outlet.count({
      where: { uuid: { in: uuids }, deleted_at: null, is_active: true, is_excluded: false },
    });
    if (count !== uuids.length) throw new Error("Ada outlet yang tidak tersedia. Muat ulang daftar outlet.");
    if (original) {
      const current = await tx.tbl_nt_bs_summary_exclusion.findFirst({ where: { uuid, deleted_at: null } });
      if (!current) throw new Error("Pengecualian sudah berubah. Muat ulang halaman.");
      await tx.tbl_nt_bs_summary_exclusion.updateMany({
        where: { uuid_outlet: current.uuid_outlet, start_date: current.start_date, end_date: current.end_date, deleted_at: null },
        data: { deleted_at: new Date() },
      });
    }
    const conflict = await tx.tbl_nt_bs_summary_exclusion.findFirst({
      where: {
        deleted_at: null,
        uuid_outlet: { in: uuids },
        start_date: { lte: range.end_date },
        end_date: { gte: range.start_date },
      },
      include: { outlet: { select: { name: true } } },
    });
    if (conflict) {
      const error = new Error(`Rentang bertabrakan dengan pengecualian ${conflict.outlet.name} pada ${conflict.start_date.toISOString().slice(0, 10)} sampai ${conflict.end_date.toISOString().slice(0, 10)}.`);
      error.status = 409;
      throw error;
    }
    for (const uuid_outlet of uuids) {
      for (const metric of ["nilai_transaksi", "basket_size"]) {
        await tx.tbl_nt_bs_summary_exclusion.create({
          data: { uuid: randomUUID(), uuid_outlet, ...range, metric },
        });
      }
    }
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function saveNtBsSummaryExclusions(payload) {
  return writeNtBsSummaryExclusions(payload);
}

export async function updateNtBsSummaryExclusion({ uuid, ...payload }) {
  if (typeof uuid !== "string" || !uuid.trim()) throw new Error("Pengecualian wajib dipilih.");
  if (!Array.isArray(payload.outlet_uuids) || payload.outlet_uuids.length !== 1) throw new Error("Pilih satu outlet untuk pengecualian.");
  return writeNtBsSummaryExclusions(payload, uuid);
}

export async function removeNtBsSummaryExclusion(uuid) {
  if (typeof uuid !== "string" || !uuid.trim()) throw new Error("Pengecualian wajib dipilih.");
  const record = await prisma.tbl_nt_bs_summary_exclusion.findFirst({ where: { uuid, deleted_at: null } });
  if (!record) return;
  await prisma.tbl_nt_bs_summary_exclusion.updateMany({
    where: {
      uuid_outlet: record.uuid_outlet, start_date: record.start_date, end_date: record.end_date, deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });
}
