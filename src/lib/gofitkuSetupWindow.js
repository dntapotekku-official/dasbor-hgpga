export function getGofitkuSetupWindow(now = new Date()) {
  return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: now };
}

export function isWithinGofitkuSetupWindow(createdAt, window) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return created >= window.gte.getTime() && created <= window.lte.getTime();
}
