import { randomUUID } from "node:crypto";

const day_key = (date) => new Date(date).toISOString().slice(0, 10);
const finite_number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

// The month-to-date NT on day 7 fixes the marks for days 8 through month end.
// Compare with the entire previous month, using the displayed rounded NT values.
export function calculateMarkedNtBsOutlets(revenue_rows, visit_rows) {
  const revenue = new Map();
  const visits = new Map();
  const months_by_outlet = new Map();

  for (const row of revenue_rows) {
    if (!row.uuid_outlet || !row.end_date) continue;
    const start = day_key(row.start_date);
    const end = day_key(row.end_date);
    const key = `${row.uuid_outlet}|${start}|${end}`;
    revenue.set(key, (revenue.get(key) ?? 0) + finite_number(row.value));
    const months = months_by_outlet.get(row.uuid_outlet) ?? new Set();
    const month = new Date(`${start.slice(0, 7)}-01T00:00:00.000Z`);
    months.add(month.toISOString().slice(0, 7));
    month.setUTCMonth(month.getUTCMonth() + 1);
    months.add(month.toISOString().slice(0, 7));
    months_by_outlet.set(row.uuid_outlet, months);
  }
  for (const row of visit_rows) {
    if (!row.uuid_outlet || !row.end_date) continue;
    const key = `${row.uuid_outlet}|${day_key(row.start_date)}|${day_key(row.end_date)}`;
    visits.set(key, (visits.get(key) ?? 0) + finite_number(row.value));
  }
  const nt = (key) => {
    const count = visits.get(key) ?? 0;
    return count ? Math.round((revenue.get(key) ?? 0) / count) : 0;
  };
  const marked = [];
  for (const [uuid_outlet, months] of months_by_outlet) {
    for (const month of months) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const previous_start = new Date(start);
      previous_start.setUTCMonth(previous_start.getUTCMonth() - 1);
      const previous_end = new Date(start.getTime() - 86_400_000);
      const previous_key = `${uuid_outlet}|${day_key(previous_start)}|${day_key(previous_end)}`;
      const decision_key = `${uuid_outlet}|${day_key(start)}|${month}-07`;
      // Missing data must clear the marks rather than count as an NT of zero.
      if (
        !revenue.has(decision_key) || !revenue.has(previous_key)
        || (visits.get(decision_key) ?? 0) <= 0
        || (visits.get(previous_key) ?? 0) <= 0
        || nt(decision_key) >= nt(previous_key)
      ) continue;

      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
      for (let day = 8; day <= end.getUTCDate(); day += 1) {
        const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
        marked.push({ uuid_outlet, date });
      }
    }
  }
  return marked;
}

function chunks(items, size = 500) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

// Run on writes and during the initial backfill, never during report reads.
export async function refreshMarkedNtBsOutlets(database) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await database.$transaction(async (tx) => {
        const select = { uuid_outlet: true, start_date: true, end_date: true, value: true };
        const revenue = await tx.tbl_total_penerimaan_pendapatan.findMany({
          where: { deleted_at: null }, select,
        });
        const visits = await tx.tbl_kunjungan.findMany({
          where: { deleted_at: null, metric: "nilai_transaksi" }, select,
        });
        const marked = calculateMarkedNtBsOutlets(revenue, visits);
        const existing = await tx.tbl_marked_nt_bs_outlet.findMany({
          select: { id: true, uuid_outlet: true, date: true, deleted_at: true },
        });
        const key = (row) => `${row.uuid_outlet}|${day_key(row.date)}`;
        const existing_by_key = new Map(existing.map((row) => [key(row), row]));
        const marked_keys = new Set(marked.map(key));
        const added = marked.filter((row) => !existing_by_key.has(key(row)));
        const restored = existing.filter((row) => row.deleted_at && marked_keys.has(key(row)));
        const removed = existing.filter((row) => !row.deleted_at && !marked_keys.has(key(row)));

        for (const batch of chunks(added)) {
          await tx.tbl_marked_nt_bs_outlet.createMany({
            data: batch.map((row) => ({ ...row, uuid: randomUUID() })),
          });
        }
        for (const batch of chunks(restored)) {
          await tx.tbl_marked_nt_bs_outlet.updateMany({
            where: { id: { in: batch.map((row) => row.id) } },
            data: { deleted_at: null },
          });
        }
        const deleted_at = new Date();
        for (const batch of chunks(removed)) {
          await tx.tbl_marked_nt_bs_outlet.updateMany({
            where: { id: { in: batch.map((row) => row.id) } },
            data: { deleted_at },
          });
        }
        return { marked: marked.length, added: added.length, restored: restored.length, removed: removed.length };
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
    } catch (error) {
      if (error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
}

export function withMarkedNtBsRefresh(database, mutate) {
  return async (...args) => {
    const result = await mutate(...args);
    await refreshMarkedNtBsOutlets(database);
    return result;
  };
}
