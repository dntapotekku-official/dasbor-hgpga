import { randomUUID } from "node:crypto";

export function buildDefaultPlacementTarget() {
  return {
    create: {
      uuid: randomUUID(),
      value: 10,
      start_date: new Date("2026-01-01T00:00:00.000Z"),
      end_date: null,
    },
  };
}
