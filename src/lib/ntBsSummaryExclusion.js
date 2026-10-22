export function exclusionDateKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10);
}

export function parseExclusionRange(start_date, end_date) {
  const parse = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Rentang tanggal wajib diisi dengan format YYYY-MM-DD.");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Tanggal pengecualian tidak valid.");
    return date;
  };
  const start = parse(start_date);
  const end = parse(end_date);
  if (start > end) throw new Error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
  return { start_date: start, end_date: end };
}

export function findExclusionConflict(exclusions, { outlet_uuids, start_date, end_date }) {
  const start = exclusionDateKey(start_date);
  const end = exclusionDateKey(end_date);
  return exclusions.find((item) => !item.deleted_at
    && outlet_uuids.includes(item.uuid_outlet)
    && exclusionDateKey(item.start_date) <= end && exclusionDateKey(item.end_date) >= start);
}

// Each column follows the cutoff date of its own reporting period.
export function applySummaryExclusions(rows, exclusions, currentDate, previousDate) {
  const current = exclusionDateKey(currentDate);
  const previous = exclusionDateKey(previousDate);
  const byOutlet = new Map();
  for (const item of exclusions) {
    if (item.deleted_at) continue;
    const key = item.uuid_outlet;
    const ranges = byOutlet.get(key) ?? [];
    ranges.push({ start: exclusionDateKey(item.start_date), end: exclusionDateKey(item.end_date) });
    byOutlet.set(key, ranges);
  }
  return rows.map((row) => ({
    ...row,
    summary_exclusions: Object.fromEntries(["nilai_transaksi", "basket_size"].map((metric) => [metric, {
      current: (byOutlet.get(row.uuid) ?? []).some((range) => range.start <= current && range.end >= current),
      previous: (byOutlet.get(row.uuid) ?? []).some((range) => range.start <= previous && range.end >= previous),
    }])),
  }));
}

// Only summary inputs change. Original detail values and outlet growth remain intact.
export function prepareMetricSummaryRows(rows) {
  return rows.map((row) => {
    const result = { ...row };
    for (const [metric, prefix, numerator] of [
      ["nilai_transaksi", "nt", "total_revenue"],
      ["basket_size", "bs", "sku_qty"],
    ]) {
      const flags = row.summary_exclusions?.[metric];
      if (flags?.current) {
        result[`${prefix}_target`] = 0;
        for (const period of ["daily", "current_month"]) {
          result[`${prefix}_${period}_${numerator}`] = 0;
          result[`${prefix}_${period}_kunjungan`] = 0;
        }
      }
      if (flags?.previous) {
        result[`${prefix}_last_month_${numerator}`] = 0;
        result[`${prefix}_last_month_kunjungan`] = 0;
      }
    }
    return result;
  });
}

export function summaryTargetCount(rows, metric) {
  return rows.filter((row) => !row.summary_exclusions?.[metric]?.current).length || 1;
}

export function summaryExclusionLabel(row, metric) {
  const flags = row.summary_exclusions?.[metric];
  if (flags?.current && flags?.previous) return "Dikecualikan dari total periode ini dan bulan sebelumnya";
  if (flags?.current) return "Dikecualikan dari total periode ini";
  if (flags?.previous) return "Dikecualikan dari total bulan sebelumnya";
  return "";
}
