const DAY = 24 * 60 * 60 * 1000;

function day(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function inactivePeriods(periods = []) {
  return periods.filter((period) => !period.deleted_at).map((period) => ({
    start: day(period.start_date),
    end: period.end_date ? day(period.end_date) : Infinity,
  })).filter((period) => period.start !== null && period.end !== null && period.end >= period.start);
}

export function parseMappingYear(value) {
  const year = Number(value);
  if (!/^\d{4}$/.test(String(value)) || year < 1900 || year > 2200) {
    throw new RangeError("Tahun harus berupa angka antara 1900 dan 2200.");
  }
  return year;
}

function activePeriods(placement, employee, employee_periods) {
  const placement_periods = inactivePeriods(placement.inactive_periods);
  // Without an open inactive period, a false status has no reliable end date.
  if ((!placement.is_active && !placement_periods.some((period) => period.end === Infinity)) ||
      (!employee.is_active && !employee_periods.some((period) => period.end === Infinity))) {
    return [];
  }

  const pre_active = placement_periods.filter((period) => period.start <= 0 && Number.isFinite(period.end));
  // Explicit effective dates may predate creation; legacy records fall back to creation.
  let cursor = pre_active.length
    ? Math.min(...pre_active.map((period) => period.end + DAY))
    : day(placement.created_at);
  if (cursor === null) return [];

  const blocked = [...placement_periods, ...employee_periods].sort((a, b) => a.start - b.start);
  const result = [];
  for (const period of blocked) {
    if (period.end < cursor) continue;
    if (period.start > cursor) result.push({ start: cursor, end: period.start - DAY });
    cursor = Math.max(cursor, period.end + DAY);
    if (cursor === Infinity) break;
  }
  if (cursor < Infinity) result.push({ start: cursor, end: Infinity });
  return result;
}

export function buildPlacementMapping(employees, requested_year) {
  const year = parseMappingYear(requested_year);
  const outlets = new Map();
  const boundaries = Array.from({ length: 12 }, (_, month) => ({
    start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) - DAY,
  }));
  const people = employees.map((employee) => {
    const months = Array.from({ length: 12 }, () => ({ segments: [] }));
    const employee_periods = inactivePeriods(employee.inactive_periods);
    for (const placement of employee.outlet_insanku ?? []) {
      if (placement.deleted_at || !placement.outlet) continue;
      outlets.set(placement.outlet.uuid, placement.outlet.name);
      const active = activePeriods(placement, employee, employee_periods);
      boundaries.forEach((boundary, month) => {
        for (const period of active) {
          const start = Math.max(boundary.start, period.start);
          const end = Math.min(boundary.end, period.end);
          if (end < start) continue;
          months[month].segments.push({
            placement_uuid: placement.uuid,
            outlet_uuid: placement.outlet.uuid,
            outlet_name: placement.outlet.name,
            start_date: new Date(start).toISOString().slice(0, 10),
            end_date: new Date(end).toISOString().slice(0, 10),
          });
        }
      });
    }
    return {
      uuid: employee.uuid, name: employee.name, nik: employee.nik ?? "",
      is_slip_gaji_account: employee.is_slip_gaji_account, months,
    };
  });
  return {
    year, people,
    outlets: Array.from(outlets, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "id-ID")),
  };
}

export function buildDailyPlacementMonth(people, requested_year, month_index, outlet_uuid = "all") {
  const year = parseMappingYear(requested_year);
  if (!Number.isInteger(month_index) || month_index < 0 || month_index > 11) {
    throw new RangeError("Bulan harus antara 0 dan 11.");
  }
  const total_days = new Date(Date.UTC(year, month_index + 1, 0)).getUTCDate();
  const outlets = new Map();
  const person_ids = new Set();
  for (const person of people) {
    for (const segment of person.months[month_index].segments) {
      if (outlet_uuid !== "all" && segment.outlet_uuid !== outlet_uuid) continue;
      if (!outlets.has(segment.outlet_uuid)) {
        outlets.set(segment.outlet_uuid, { uuid: segment.outlet_uuid, name: segment.outlet_name, rows: new Map() });
      }
      const outlet = outlets.get(segment.outlet_uuid);
      if (!outlet.rows.has(segment.placement_uuid)) {
        outlet.rows.set(segment.placement_uuid, {
          placement_uuid: segment.placement_uuid, person_name: person.name,
          days: Array(total_days).fill(false),
        });
      }
      person_ids.add(person.uuid);
      const row = outlet.rows.get(segment.placement_uuid);
      const start = Number(segment.start_date.slice(-2));
      const end = Number(segment.end_date.slice(-2));
      for (let date = start; date <= end; date += 1) row.days[date - 1] = true;
    }
  }
  const groups = Array.from(outlets.values(), (outlet) => ({
    ...outlet, rows: Array.from(outlet.rows.values()).sort((a, b) => a.person_name.localeCompare(b.person_name, "id-ID")),
  })).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  return { total_days, groups, person_count: person_ids.size };
}
