// Preserve the API's calendar date rather than shifting it across time zones.
export function parseSlipGajiJoinDate(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  const local = normalized.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!iso && !local) return null;

  const [, year, month, day] = iso ?? [null, local[3], local[2], local[1]];
  if (Number(year) === 0) return null;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) {
    return null;
  }
  return date;
}
