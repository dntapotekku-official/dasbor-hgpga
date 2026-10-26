import { randomUUID } from "node:crypto";

export function buildDefaultPlacementTarget(start_date, now = new Date()) {
  let resolved_start_date = start_date;

  if (!resolved_start_date) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Makassar",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now).map((part) => [part.type, part.value]),
    );
    resolved_start_date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
  }

  return {
    create: {
      uuid: randomUUID(),
      value: 10,
      start_date: resolved_start_date,
      end_date: null,
    },
  };
}
