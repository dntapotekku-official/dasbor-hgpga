export function getDashboardPeriods(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month) - 1;
  const previousMonth = new Date(Date.UTC(year, month - 1, 1));
  const yesterday = new Date(Date.UTC(year, month, Number(parts.day) - 1));
  return {
    kepuasan_year: String(previousMonth.getUTCFullYear()),
    kepuasan_month: previousMonth.toISOString().slice(0, 7),
    kepuasan_label: new Intl.DateTimeFormat("id-ID", {
      month: "long", year: "numeric", timeZone: "UTC",
    }).format(previousMonth),
    ntbs_date: yesterday.toISOString().slice(0, 10),
    ntbs_label: new Intl.DateTimeFormat("id-ID", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(yesterday),
  };
}
