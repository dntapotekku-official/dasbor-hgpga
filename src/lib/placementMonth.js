export function parsePlacementMonth(value, label = "Bulan penempatan") {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) {
    throw new Error(`${label} tidak valid.`);
  }
  const month = value.slice(0, 7);
  const date = new Date(`${month}-01T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 7) !== month) {
    throw new Error(`${label} tidak valid.`);
  }
  if (value.length === 10) {
    const legacy = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(legacy.getTime()) || legacy.toISOString().slice(0, 10) !== value) throw new Error(`${label} tidak valid.`);
  }
  return date;
}

export function currentPlacementMonth(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar", year: "numeric", month: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return parsePlacementMonth(`${parts.year}-${parts.month}`);
}
