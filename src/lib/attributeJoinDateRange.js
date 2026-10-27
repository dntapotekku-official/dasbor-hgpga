export function getJoinDateRangeDays(join_date, attribute_date) {
  const parse = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? date.getTime()
      : null;
  };
  const start = parse(join_date);
  const end = parse(attribute_date);
  if (start === null || end === null || end < start) return null;
  return Math.floor((end - start) / 86400000) + 1;
}
