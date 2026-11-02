export function getGofitkuChartPeriod(month, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar", year: "numeric", month: "2-digit",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const value = String(month ?? "").trim() || `${parts.year}-${parts.month}`;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1000) {
    throw new Error("Periode harus berupa bulan yang valid (YYYY-MM).");
  }

  const [year, month_number] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, month_number - 1, 1));
  const end = new Date(Date.UTC(year, month_number, 1));

  return {
    month: value,
    label: new Intl.DateTimeFormat("id-ID", {
      timeZone: "UTC", month: "long", year: "numeric",
    }).format(start),
    date_range: { gte: start, lt: end },
  };
}
