// Date columns are retained for future use; active exclusions currently apply permanently.
export function isGofitkuExcluded(exclusions = []) {
  return exclusions.some((item) => !item.deleted_at);
}

export function permanentGofitkuExclusionDates() {
  // The existing start_date column is required; this is only a storage default.
  return { start_date: new Date("1970-01-01T00:00:00.000Z"), end_date: null };
}
