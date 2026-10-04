export function buildPenjualanGofitkuGroups({
  active_relations,
  sales_rows,
  selected_date,
  day_end,
  week_start,
  week_end,
  month_start,
  month_end,
  target_map,
}) {
  const active_relation_uuids = new Set(active_relations.map((item) => item.uuid));
  const relation_map = new Map(active_relations.map((item) => [item.uuid, item]));
  const today_sales = sales_rows.filter(
    (sale) => sale.date >= selected_date && sale.date < day_end,
  );
  const visible_relation_uuids = new Set(active_relation_uuids);

  for (const sale of sales_rows) {
    if (sale.outlet_insanku) {
      relation_map.set(sale.outlet_insanku.uuid, sale.outlet_insanku);
    }
  }
  for (const sale of today_sales) {
    visible_relation_uuids.add(sale.uuid_outlet_insanku);
  }

  const groups_map = new Map();
  const summary_map = new Map();
  const archived_summary_map = new Map();

  for (const relation of relation_map.values()) {
    if (!groups_map.has(relation.uuid_outlet)) {
      groups_map.set(relation.uuid_outlet, {
        uuid: relation.outlet?.uuid ?? relation.uuid_outlet,
        outlet_name: relation.outlet?.name ?? "-",
        kategori: relation.outlet?.category ?? null,
        rows: [],
        detail_rows: [],
      });
    }

    if (!visible_relation_uuids.has(relation.uuid)) {
      continue;
    }

    const row = {
      uuid: relation.uuid_insanku ?? relation.uuid,
      name: relation.insanku?.name ?? "-",
      is_active: active_relation_uuids.has(relation.uuid),
      today_input: 0,
      weekly_total: 0,
      monthly_total: 0,
      daily_totals: {},
      target: target_map.get(relation.uuid_insanku) ?? 0,
    };
    summary_map.set(relation.uuid, row);
    groups_map.get(relation.uuid_outlet).rows.push(row);
  }

  for (const sale of sales_rows) {
    const relation = relation_map.get(sale.uuid_outlet_insanku);
    if (!relation) {
      continue;
    }

    let row = summary_map.get(relation.uuid);
    if (!row) {
      row = archived_summary_map.get(relation.uuid_outlet);
      if (!row) {
        row = {
          uuid: `archived:${relation.uuid_outlet}`,
          name: "Penjualan penempatan nonaktif",
          is_active: false,
          today_input: 0,
          weekly_total: 0,
          monthly_total: 0,
          daily_totals: {},
          target: 0,
        };
        archived_summary_map.set(relation.uuid_outlet, row);
        groups_map.get(relation.uuid_outlet).rows.push(row);
      }
    }

    const qty = Number(sale.qty || 0);
    if (sale.date >= week_start && sale.date < week_end) {
      row.weekly_total += qty;
    }
    if (sale.date >= month_start && sale.date < month_end) {
      row.monthly_total += qty;
      const day = sale.date.getUTCDate();
      row.daily_totals[day] = Number(row.daily_totals[day] || 0) + qty;
    }
    if (sale.date >= selected_date && sale.date < day_end) {
      row.today_input += qty;
      groups_map.get(relation.uuid_outlet).detail_rows.push({
        uuid: sale.uuid,
        employee_uuid: relation.uuid_insanku ?? "",
        name: relation.insanku?.name ?? "-",
        product_name: sale.name ?? "-",
        produk_uuid: sale.uuid_produk_gofitku ?? "",
        today_input: qty,
        date: sale.date.toISOString().slice(0, 10),
      });
    }
  }

  return Array.from(groups_map.values());
}
