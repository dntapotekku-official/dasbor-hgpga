import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";
import {
  buildPenjualanGofitkuGroups,
  isGofitkuRelationAvailableInRange,
  isGofitkuRelationAvailableOnDate,
} from "@/lib/penjualanGofitkuReport";
import { isDateInInactivePeriods } from "@/services/inactivePeriodService";

function get_date_boundaries(date_value) {
  const normalized_date = String(date_value ?? "").trim();

  if (!normalized_date) {
    throw new Error("Tanggal wajib diisi.");
  }

  const date = new Date(`${normalized_date}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Format tanggal tidak valid.");
  }

  const month_start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const month_end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const day_end = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const week_day = date.getUTCDay();
  const days_since_monday = (week_day + 6) % 7;
  const week_start = new Date(date.getTime() - days_since_monday * 24 * 60 * 60 * 1000);
  const week_end = new Date(week_start.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    normalized_date,
    date,
    day_end,
    month_start,
    month_end,
    week_start,
    week_end,
  };
}

function get_month_key_from_date(date) {
  const normalized_date = new Date(date);
  const month = String(normalized_date.getUTCMonth() + 1).padStart(2, "0");

  return `${normalized_date.getUTCFullYear()}-${month}`;
}

function get_month_start_from_key(month_key) {
  const [year, month] = String(month_key).split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1));
}

function get_month_boundaries(month_value) {
  const normalized_month = String(month_value ?? "").trim();

  if (!normalized_month) {
    return null;
  }

  if (!/^\d{4}-\d{2}$/.test(normalized_month)) {
    throw new Error("Format tanggal harus YYYY-MM.");
  }

  const month_start = get_month_start_from_key(normalized_month);

  if (Number.isNaN(month_start.getTime())) {
    throw new Error("Format tanggal tidak valid.");
  }

  return {
    normalized_month,
    month_start,
    month_end: new Date(
      Date.UTC(
        month_start.getUTCFullYear(),
        month_start.getUTCMonth() + 1,
        1,
      ),
    ),
  };
}

function is_date_in_gofitku_exclusion(date_value, exclusion_periods = []) {
  const date = new Date(date_value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return exclusion_periods.some((period) => {
    const start_date = new Date(period.start_date);
    const end_date = period.end_date ? new Date(period.end_date) : null;

    return start_date <= date && (!end_date || end_date >= date);
  });
}

function filter_sales_by_relation_periods(sales_rows, relation_map) {
  return sales_rows.filter((sale) => {
    const relation = relation_map.get(sale.uuid_outlet_insanku);

    return relation && isGofitkuRelationAvailableOnDate(relation, sale.date);
  });
}

function build_month_keys_desc({ start_month_key, end_month_key }) {
  const start_month = get_month_start_from_key(start_month_key);
  const end_month = get_month_start_from_key(end_month_key);
  const month_keys = [];
  const cursor = new Date(end_month);

  while (cursor >= start_month) {
    month_keys.push(get_month_key_from_date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  return month_keys;
}

async function get_member_outlet_uuids(account_uuid) {
  const trimmed_account_uuid = String(account_uuid ?? "").trim();

  if (!trimmed_account_uuid) {
    return [];
  }

  const outlet = await prisma.tbl_outlet.findFirst({
    where: {
      uuid: trimmed_account_uuid,
      deleted_at: null,
      is_active: true,
      excep: false,
    },
    select: {
      uuid: true,
    },
  });

  return outlet ? [outlet.uuid] : [];
}

async function get_accessible_outlet_uuids({ account_uuid, role }) {
  const normalized_role = String(role ?? "").trim().toLowerCase();
  const trimmed_account_uuid = String(account_uuid ?? "").trim();

  if (normalized_role !== "member") {
    return null;
  }

  return get_member_outlet_uuids(trimmed_account_uuid);
}

async function assert_outlet_access({ outlet_uuid, account_uuid, role }) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    account_uuid,
    role,
  });

  if (
    accessible_outlet_uuids &&
    !accessible_outlet_uuids.includes(outlet_uuid)
  ) {
    throw new Error("Outlet tidak dapat diakses.");
  }
}

const report_relation_select = {
  uuid: true,
  uuid_outlet: true,
  uuid_insanku: true,
  is_active: true,
  inactive_periods: {
    where: { deleted_at: null },
    select: { start_date: true, end_date: true },
  },
  outlet: {
    select: { uuid: true, name: true, category: true },
  },
  insanku: {
    select: {
      uuid: true,
      name: true,
      is_active: true,
      inactive_periods: {
        where: { deleted_at: null },
        select: { start_date: true, end_date: true },
      },
      gofitku_exclusion_periods: {
        where: { deleted_at: null },
        select: { start_date: true, end_date: true },
      },
    },
  },
};

async function get_outlet_insanku_rows(
  accessible_outlet_uuids,
  active_date = null,
  { include_inactive = false } = {},
) {
  const rows = await prisma.tbl_outlet_insanku.findMany({
    where: {
      deleted_at: null,
      ...(accessible_outlet_uuids
        ? {
            uuid_outlet: {
              in: accessible_outlet_uuids,
            },
          }
        : {}),
      outlet: {
        deleted_at: null,
        is_active: true,
        excep: false,
      },
      insanku: {
        deleted_at: null,
      },
    },
    orderBy: [
      {
        outlet: {
          name: "asc",
        },
      },
      {
        insanku: {
          name: "asc",
        },
      },
    ],
    select: report_relation_select,
  });

  return active_date
    ? rows.filter((row) =>
        isGofitkuRelationAvailableOnDate(row, active_date),
      )
    : include_inactive
      ? rows
      : rows.filter((row) => row.is_active && row.insanku?.is_active !== false);
}

async function get_report_sales(accessible_outlet_uuids, date_range) {
  return prisma.tbl_penjualan_gofitku.findMany({
    where: {
      deleted_at: null,
      ...(date_range ? { date: date_range } : {}),
      outlet_insanku: {
        ...(accessible_outlet_uuids
          ? { uuid_outlet: { in: accessible_outlet_uuids } }
          : {}),
        outlet: { excep: false },
      },
    },
    orderBy: [{ date: "asc" }, { created_at: "asc" }],
    select: {
      uuid: true,
      uuid_outlet_insanku: true,
      uuid_produk_gofitku: true,
      name: true,
      qty: true,
      date: true,
      outlet_insanku: { select: report_relation_select },
    },
  });
}

function get_report_relations(active_relations, sales_rows) {
  const relations = new Map(active_relations.map((item) => [item.uuid, item]));

  for (const sale of sales_rows) {
    const relation = sale.outlet_insanku;
    if (relation) {
      relations.set(relation.uuid, relation);
    }
  }

  return relations;
}

function get_top_five_chart_rows(rows) {
  return rows
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.label.localeCompare(right.label, "id");
    })
    .slice(0, 5);
}

export async function getPenjualanGofitku({
  date,
  outlet_uuid,
  account_uuid,
  role,
}) {
  const {
    date: selected_date,
    day_end,
    month_start,
    month_end,
    week_start,
    week_end,
  } =
    get_date_boundaries(date);
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();
  const member_outlet_uuids = await get_accessible_outlet_uuids({
    account_uuid,
    role,
  });

  if (
    member_outlet_uuids &&
    (!member_outlet_uuids.length ||
      (trimmed_outlet_uuid &&
        !member_outlet_uuids.includes(trimmed_outlet_uuid)))
  ) {
    return {
      outlet_groups: [],
    };
  }

  const accessible_outlet_uuids = trimmed_outlet_uuid
    ? [trimmed_outlet_uuid]
    : member_outlet_uuids;

  const active_relations = await get_outlet_insanku_rows(
    accessible_outlet_uuids,
    selected_date,
  );
  const sales_range_start = week_start < month_start ? week_start : month_start;
  const sales_range_end = week_end > month_end ? week_end : month_end;
  const raw_sales_rows = await get_report_sales(accessible_outlet_uuids, {
    gte: sales_range_start,
    lt: sales_range_end,
  });
  const relation_map = get_report_relations(active_relations, raw_sales_rows);
  const sales_rows = filter_sales_by_relation_periods(
    raw_sales_rows,
    relation_map,
  );
  const report_relation_map = get_report_relations(active_relations, sales_rows);
  const accessible_relation_uuids = Array.from(
    new Set(
      Array.from(report_relation_map.values())
        .map((item) => item.uuid)
        .filter(Boolean),
    ),
  );
  const active_targets = await prisma.tbl_target_gofitku.findMany({
    where: {
      deleted_at: null,
      ...(accessible_relation_uuids.length
        ? {
            uuid_outlet_insanku: {
              in: accessible_relation_uuids,
            },
          }
        : { uuid_outlet_insanku: { in: [] } }),
      start_date: {
        lte: selected_date,
      },
      OR: [
        {
          end_date: null,
        },
        {
          end_date: {
            gte: selected_date,
          },
        },
      ],
    },
    orderBy: {
      start_date: "desc",
    },
    select: {
      uuid_outlet_insanku: true,
      value: true,
    },
  });
  const active_target_map = new Map();

  for (const item of active_targets) {
    const uuid_outlet_insanku = String(item.uuid_outlet_insanku ?? "").trim();

    if (
      !uuid_outlet_insanku ||
      active_target_map.has(uuid_outlet_insanku)
    ) {
      continue;
    }

    active_target_map.set(uuid_outlet_insanku, item.value ?? 0);
  }

  return {
    outlet_groups: buildPenjualanGofitkuGroups({
      active_relations,
      sales_rows,
      selected_date,
      day_end,
      week_start,
      week_end,
      month_start,
      month_end,
      target_map: active_target_map,
    }),
  };
}

export async function getExternalPenjualanGofitku({
  uuid_outlet,
  tanggal,
}) {
  const trimmed_uuid_outlet = String(uuid_outlet ?? "").trim();
  const month_boundaries = get_month_boundaries(tanggal);

  if (trimmed_uuid_outlet) {
    const outlet = await prisma.tbl_outlet.findFirst({
      where: {
        uuid: trimmed_uuid_outlet,
        deleted_at: null,
        is_active: true,
        excep: false,
      },
      select: {
        uuid: true,
      },
    });

    if (!outlet) {
      throw new Error("Outlet tidak ditemukan.");
    }
  }

  const placement_rows = await prisma.tbl_outlet_insanku.findMany({
    where: {
      ...(trimmed_uuid_outlet
        ? {
            uuid_outlet: trimmed_uuid_outlet,
          }
        : {}),
      deleted_at: null,
      is_active: true,
      outlet: {
        deleted_at: null,
        is_active: true,
        excep: false,
      },
      insanku: {
        deleted_at: null,
        is_active: true,
      },
    },
    orderBy: [
      {
        outlet: {
          name: "asc",
        },
      },
      {
        insanku: {
          name: "asc",
        },
      },
    ],
    select: {
      uuid: true,
      uuid_outlet: true,
      uuid_insanku: true,
      inactive_periods: {
        where: {
          deleted_at: null,
        },
        select: {
          start_date: true,
          end_date: true,
        },
      },
      insanku: {
        select: {
          name: true,
          inactive_periods: {
            where: {
              deleted_at: null,
            },
            select: {
              start_date: true,
              end_date: true,
            },
          },
          gofitku_exclusion_periods: {
            where: {
              deleted_at: null,
            },
            select: {
              start_date: true,
              end_date: true,
            },
          },
        },
      },
    },
  });
  const active_placement_rows = month_boundaries
    ? placement_rows.filter((placement) =>
        isGofitkuRelationAvailableInRange(
          placement,
          month_boundaries.month_start,
          month_boundaries.month_end,
        ),
      )
    : placement_rows;
  const placement_uuids = active_placement_rows.map((item) => item.uuid);
  const placement_map = new Map(
    active_placement_rows.map((item) => [item.uuid, item]),
  );
  const sales_rows = await prisma.tbl_penjualan_gofitku.findMany({
    where: {
      deleted_at: null,
      ...(month_boundaries
        ? {
            date: {
              gte: month_boundaries.month_start,
              lt: month_boundaries.month_end,
            },
          }
        : {}),
      ...(placement_uuids.length
        ? {
            uuid_outlet_insanku: {
              in: placement_uuids,
            },
          }
        : {
            uuid_outlet_insanku: {
              in: [],
            },
          }),
    },
    select: {
      qty: true,
      date: true,
      uuid_outlet_insanku: true,
    },
  });
  const sales_total_map = new Map();

  for (const row of sales_rows) {
    const uuid_outlet_insanku = String(row.uuid_outlet_insanku ?? "").trim();
    const placement = placement_map.get(uuid_outlet_insanku);

    if (
      !uuid_outlet_insanku ||
      !placement ||
      !isGofitkuRelationAvailableOnDate(placement, row.date)
    ) {
      continue;
    }

    sales_total_map.set(
      uuid_outlet_insanku,
      (sales_total_map.get(uuid_outlet_insanku) ?? 0) + (row.qty ?? 0),
    );
  }

  const group_map = new Map();

  for (const placement of active_placement_rows) {
    const uuid_outlet_row = String(placement.uuid_outlet ?? "").trim();
    const uuid_insanku = String(placement.uuid_insanku ?? "").trim();

    if (!uuid_outlet_row || !uuid_insanku) {
      continue;
    }

    const group = group_map.get(uuid_outlet_row) ?? {
      uuid_outlet: uuid_outlet_row,
      insanku: [],
    };

    group.insanku.push({
      uuid_insanku,
      nama: placement.insanku?.name ?? "-",
      total: sales_total_map.get(placement.uuid) ?? 0,
    });
    group_map.set(uuid_outlet_row, group);
  }

  return Array.from(group_map.values()).map((group) => ({
    uuid_outlet: group.uuid_outlet,
    ...(month_boundaries ? { tanggal: month_boundaries.normalized_month } : {}),
    insanku: group.insanku.sort((left, right) =>
      left.nama.localeCompare(right.nama, "id"),
    ),
  }));
}

export async function getPenjualanGofitkuExport({ account_uuid, role }) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    account_uuid,
    role,
  });

  if (accessible_outlet_uuids && !accessible_outlet_uuids.length) {
    return {
      outlet_groups: [],
    };
  }

  const active_relations = await get_outlet_insanku_rows(
    accessible_outlet_uuids,
    null,
    { include_inactive: true },
  );
  const raw_sales_rows = await get_report_sales(accessible_outlet_uuids);
  const relation_map = get_report_relations(active_relations, raw_sales_rows);
  const sales_rows = filter_sales_by_relation_periods(
    raw_sales_rows,
    relation_map,
  );
  const report_relation_map = get_report_relations(active_relations, sales_rows);
  const accessible_relation_uuids = Array.from(
    new Set(
      Array.from(report_relation_map.values())
        .map((item) => item.uuid)
        .filter(Boolean),
    ),
  );
  const sorted_sale_month_keys = Array.from(
    new Set(sales_rows.map((sale) => get_month_key_from_date(sale.date))),
  ).sort();
  const fallback_current_month_key = get_month_key_from_date(new Date());
  const month_keys = build_month_keys_desc({
    start_month_key: sorted_sale_month_keys[0] ?? fallback_current_month_key,
    end_month_key:
      sorted_sale_month_keys[sorted_sale_month_keys.length - 1] ??
      fallback_current_month_key,
  });
  const targets = await prisma.tbl_target_gofitku.findMany({
    where: {
      deleted_at: null,
      ...(accessible_relation_uuids.length
        ? {
            uuid_outlet_insanku: {
              in: accessible_relation_uuids,
            },
          }
        : { uuid_outlet_insanku: { in: [] } }),
    },
    orderBy: {
      start_date: "desc",
    },
    select: {
      uuid_outlet_insanku: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });
  const relations_by_outlet = new Map();
  const groups_map = new Map();
  
  for (const relation of report_relation_map.values()) {
    if (!groups_map.has(relation.uuid_outlet)) {
      groups_map.set(relation.uuid_outlet, {
        uuid: relation.outlet?.uuid ?? relation.uuid_outlet,
        outlet_name: relation.outlet?.name ?? "-",
        monthly_groups: [],
      });
    }
  
    const outlet_relations = relations_by_outlet.get(relation.uuid_outlet) ?? [];
    outlet_relations.push(relation);
    relations_by_outlet.set(relation.uuid_outlet, outlet_relations);
  }
  
  const sales_by_month = new Map();
  
  for (const sale of sales_rows) {
    const month_key = get_month_key_from_date(sale.date);
    const month_sales = sales_by_month.get(month_key) ?? [];
    month_sales.push(sale);
    sales_by_month.set(month_key, month_sales);
  }
  
  const get_target_for_month = (uuid_outlet_insanku, month_start) => {
    const target = targets.find((item) => {
      if (
        String(item.uuid_outlet_insanku ?? "").trim() !==
        String(uuid_outlet_insanku ?? "").trim()
      ) {
        return false;
      }

      const start_date = new Date(item.start_date);
      const end_date = item.end_date ? new Date(item.end_date) : null;
  
      return start_date <= month_start && (!end_date || end_date >= month_start);
    });
  
    return target?.value ?? 0;
  };
  
  for (const month_key of month_keys) {
    const month_start = get_month_start_from_key(month_key);
    const month_end = new Date(
      Date.UTC(
        month_start.getUTCFullYear(),
        month_start.getUTCMonth() + 1,
        1,
      ),
    );
    const year = month_start.getUTCFullYear();
    const month = month_start.getUTCMonth() + 1;
    const total_days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const month_sales = sales_by_month.get(month_key) ?? [];
  
    for (const group of groups_map.values()) {
      const group_relations = (relations_by_outlet.get(group.uuid) ?? []).filter(
        (relation) =>
          isGofitkuRelationAvailableInRange(
            relation,
            month_start,
            month_end,
          ),
      );
      const row_map = new Map(
        group_relations.map((relation) => [
          relation.uuid,
          {
            uuid: relation.uuid_insanku ?? relation.uuid,
            name: relation.insanku?.name ?? "-",
            monthly_total: 0,
            daily_totals: {},
            target: get_target_for_month(relation.uuid, month_start),
          },
        ]),
      );
  
      for (const sale of month_sales) {
        const relation = relation_map.get(sale.uuid_outlet_insanku);
  
        if (!relation || relation.uuid_outlet !== group.uuid) {
          continue;
        }
  
        const current_row = row_map.get(relation.uuid);
  
        if (!current_row) {
          continue;
        }
  
        const sale_day = new Date(sale.date).getUTCDate();
  
        current_row.monthly_total += Number(sale.qty || 0);
        current_row.daily_totals[sale_day] =
          Number(current_row.daily_totals[sale_day] || 0) + Number(sale.qty || 0);
      }
  
      group.monthly_groups.push({
        month_key,
        total_days,
        rows: Array.from(row_map.values()),
      });
    }
  }
  
  return {
    outlet_groups: Array.from(groups_map.values()),
  };
}

async function get_gofitku_chart_scope({
  account_uuid,
  role,
}, { include_outlet = true } = {}) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    account_uuid,
    role,
  });

  if (accessible_outlet_uuids && !accessible_outlet_uuids.length) {
    return [];
  }

  return prisma.tbl_outlet_insanku.findMany({
    where: {
      ...(accessible_outlet_uuids
        ? {
            uuid_outlet: {
              in: accessible_outlet_uuids,
            },
          }
        : {}),
      outlet: {
        excep: false,
      },
      OR: [
        {
          deleted_at: null,
          insanku: { deleted_at: null, is_active: true },
          outlet: { deleted_at: null, is_active: true },
        },
        { penjualan_gofitku: { some: { deleted_at: null } } },
      ],
    },
    select: {
      uuid: true,
      ...(include_outlet
        ? {
            uuid_outlet: true,
            outlet: {
              select: {
                uuid: true,
                name: true,
              },
            },
          }
        : {}),
      insanku: {
        select: {
          gofitku_exclusion_periods: {
            where: {
              deleted_at: null,
            },
            select: {
              start_date: true,
              end_date: true,
            },
          },
        },
      },
    },
  });
}

function build_top_outlet_chart(outlet_insanku_rows, sales_totals) {
  const relation_map = new Map(outlet_insanku_rows.map((item) => [item.uuid, item]));
  const outlet_chart_map = new Map();
  
  for (const relation of outlet_insanku_rows) {
    if (!outlet_chart_map.has(relation.uuid_outlet)) {
      outlet_chart_map.set(relation.uuid_outlet, {
        key: relation.outlet?.uuid ?? relation.uuid_outlet,
        label: relation.outlet?.name ?? "-",
        value: 0,
      });
    }
  }
  
  for (const total_row of sales_totals) {
    const relation = relation_map.get(total_row.uuid_outlet_insanku);
  
    if (!relation) {
      continue;
    }
  
    const outlet_chart = outlet_chart_map.get(relation.uuid_outlet);
  
    if (!outlet_chart) {
      continue;
    }
  
    outlet_chart.value += Number(total_row._sum.qty || 0);
  }
  
  return get_top_five_chart_rows(Array.from(outlet_chart_map.values()));
}

function build_top_product_chart(product_totals) {
  return get_top_five_chart_rows(
    product_totals.map((item) => ({
      key: item.name ?? "-",
      label: item.name ?? "-",
      value: Number(item._sum.qty || 0),
    })),
  );
}

async function get_outlet_sales_totals(relation_uuid_set, relation_map) {
  if (!relation_uuid_set.length) return [];

  const rows = await prisma.tbl_penjualan_gofitku.findMany({
    where: {
      deleted_at: null,
      uuid_outlet_insanku: {
        in: relation_uuid_set,
      },
    },
    select: {
      uuid_outlet_insanku: true,
      qty: true,
      date: true,
    },
  });
  const filtered_rows = filter_sales_by_relation_periods(rows, relation_map);
  const totals = new Map();

  for (const row of filtered_rows) {
    totals.set(
      row.uuid_outlet_insanku,
      Number(totals.get(row.uuid_outlet_insanku) || 0) + Number(row.qty || 0),
    );
  }

  return Array.from(totals.entries()).map(([uuid_outlet_insanku, total]) => ({
    uuid_outlet_insanku,
    _sum: {
      qty: total,
    },
  }));
}

async function get_product_sales_totals(relation_uuid_set, relation_map) {
  if (!relation_uuid_set.length) return [];

  const rows = await prisma.tbl_penjualan_gofitku.findMany({
    where: {
      deleted_at: null,
      uuid_outlet_insanku: {
        in: relation_uuid_set,
      },
    },
    select: {
      uuid_outlet_insanku: true,
      name: true,
      qty: true,
      date: true,
    },
  });
  const filtered_rows = filter_sales_by_relation_periods(rows, relation_map);
  const totals = new Map();

  for (const row of filtered_rows) {
    totals.set(row.name, Number(totals.get(row.name) || 0) + Number(row.qty || 0));
  }

  return Array.from(totals.entries()).map(([name, total]) => ({
    name,
    _sum: {
      qty: total,
    },
  }));
}

export async function getPenjualanGofitkuTopOutletChart() {
  const outlet_insanku_rows = await get_gofitku_chart_scope({
    role: null,
  });
  const relation_map = new Map(outlet_insanku_rows.map((item) => [item.uuid, item]));
  const totals = await get_outlet_sales_totals(
    outlet_insanku_rows.map((item) => item.uuid),
    relation_map,
  );

  return {
    chart_data: build_top_outlet_chart(outlet_insanku_rows, totals),
  };
}

export async function getPenjualanGofitkuTopProdukChart(context) {
  const outlet_insanku_rows = await get_gofitku_chart_scope(context, {
    include_outlet: false,
  });
  const relation_map = new Map(outlet_insanku_rows.map((item) => [item.uuid, item]));
  const totals = await get_product_sales_totals(
    outlet_insanku_rows.map((item) => item.uuid),
    relation_map,
  );

  return {
    chart_data: build_top_product_chart(totals),
  };
}

export async function createPenjualanGofitku({
  outlet_uuid,
  entries = [],
  account_uuid,
  role,
}) {
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();

  if (!trimmed_outlet_uuid) {
    throw new Error("Outlet wajib diisi.");
  }

  await assert_outlet_access({
    outlet_uuid: trimmed_outlet_uuid,
    account_uuid,
    role,
  });

  const normalized_entries = entries
    .map((entry) => ({
      employee_uuid: String(entry?.employee_uuid ?? "").trim(),
      produk_uuid: String(entry?.produk_uuid ?? "").trim(),
      product_name: String(entry?.product_name ?? "").trim(),
      date: String(entry?.date ?? "").trim(),
      sales_total: Number(entry?.sales_total ?? 0),
    }))
    .filter((entry) => entry.employee_uuid && entry.date && entry.sales_total >= 0);

  if (!normalized_entries.length) {
    throw new Error("Entri penjualan belum tersedia.");
  }

  const employee_uuid_set = Array.from(
    new Set(normalized_entries.map((entry) => entry.employee_uuid)),
  );
  const product_uuid_set = Array.from(
    new Set(normalized_entries.map((entry) => entry.produk_uuid).filter(Boolean)),
  );

  const outlet_insanku_rows = await prisma.tbl_outlet_insanku.findMany({
    where: {
      uuid_outlet: trimmed_outlet_uuid,
      uuid_insanku: {
        in: employee_uuid_set,
      },
      deleted_at: null,
      outlet: {
        deleted_at: null,
        is_active: true,
        excep: false,
      },
      insanku: {
        deleted_at: null,
      },
    },
    select: {
      uuid: true,
      uuid_insanku: true,
      inactive_periods: {
        where: { deleted_at: null },
        select: { start_date: true, end_date: true },
      },
      insanku: {
        select: {
          name: true,
          inactive_periods: {
            where: { deleted_at: null },
            select: { start_date: true, end_date: true },
          },
          gofitku_exclusion_periods: {
            where: {
              deleted_at: null,
            },
            select: {
              start_date: true,
              end_date: true,
            },
          },
        },
      },
    },
  });

  const relation_map = new Map(
    outlet_insanku_rows.map((item) => [item.uuid_insanku, item.uuid]),
  );
  const relation_by_employee_uuid = new Map(
    outlet_insanku_rows.map((item) => [item.uuid_insanku, item]),
  );

  if (relation_map.size !== employee_uuid_set.length) {
    throw new Error("Sebagian InsanKu tidak terhubung dengan outlet yang dipilih.");
  }

  const product_rows = product_uuid_set.length
    ? await prisma.tbl_produk_gofitku.findMany({
        where: {
          uuid: {
            in: product_uuid_set,
          },
          deleted_at: null,
        },
        select: {
          uuid: true,
          name: true,
        },
      })
    : [];

  const product_map = new Map(product_rows.map((item) => [item.uuid, item.name]));

  await prisma.$transaction(
    normalized_entries.map((entry) => {
      const { date } = get_date_boundaries(entry.date);
      const relation = relation_by_employee_uuid.get(entry.employee_uuid);

      if (
        isDateInInactivePeriods(date, relation?.inactive_periods) ||
        isDateInInactivePeriods(date, relation?.insanku?.inactive_periods)
      ) {
        throw new Error(
          `${relation?.insanku?.name ?? "InsanKu"} tidak aktif pada tanggal tersebut.`,
        );
      }

      if (
        is_date_in_gofitku_exclusion(
          date,
          relation?.insanku?.gofitku_exclusion_periods,
        )
      ) {
        throw new Error(
          `${relation?.insanku?.name ?? "InsanKu"} sedang dikecualikan dari Penjualan GoFitKu pada tanggal tersebut.`,
        );
      }

      const fallback_name = entry.produk_uuid
        ? product_map.get(entry.produk_uuid) ?? entry.product_name
        : entry.product_name;

      if (!fallback_name) {
        throw new Error("Nama produk wajib tersedia.");
      }

      return prisma.tbl_penjualan_gofitku.create({
        data: {
          uuid: randomUUID(),
          uuid_outlet_insanku: relation_map.get(entry.employee_uuid) ?? null,
          uuid_produk_gofitku: entry.produk_uuid || null,
          name: fallback_name,
          date,
          qty: Math.max(0, Math.trunc(entry.sales_total)),
        },
      });
    }),
  );

  return {
    success: true,
    message: "Penjualan GoFitKu berhasil disimpan.",
  };
}

export async function updatePenjualanGofitku({
  uuid_penjualan_gofitku,
  outlet_uuid,
  employee_uuid,
  produk_uuid,
  product_name,
  date,
  sales_total,
  account_uuid,
  role,
}) {
  const trimmed_uuid = String(uuid_penjualan_gofitku ?? "").trim();
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();
  const trimmed_employee_uuid = String(employee_uuid ?? "").trim();
  const trimmed_produk_uuid = String(produk_uuid ?? "").trim();
  const trimmed_product_name = String(product_name ?? "").trim();
  const normalized_sales_total = Number(sales_total ?? 0);

  if (!trimmed_uuid) {
    throw new Error("UUID penjualan wajib diisi.");
  }

  if (!trimmed_outlet_uuid) {
    throw new Error("Outlet wajib diisi.");
  }

  if (!trimmed_employee_uuid) {
    throw new Error("InsanKu wajib diisi.");
  }

  await assert_outlet_access({
    outlet_uuid: trimmed_outlet_uuid,
    account_uuid,
    role,
  });

  const existing_penjualan = await prisma.tbl_penjualan_gofitku.findUnique({
    where: {
      uuid: trimmed_uuid,
    },
    select: {
      uuid: true,
      deleted_at: true,
      outlet_insanku: {
        select: {
          uuid: true,
          uuid_outlet: true,
          uuid_insanku: true,
          deleted_at: true,
          inactive_periods: {
            where: { deleted_at: null },
            select: { start_date: true, end_date: true },
          },
          insanku: {
            select: {
              name: true,
              inactive_periods: {
                where: { deleted_at: null },
                select: { start_date: true, end_date: true },
              },
              gofitku_exclusion_periods: {
                where: { deleted_at: null },
                select: { start_date: true, end_date: true },
              },
            },
          },
        },
      },
    },
  });

  if (!existing_penjualan || existing_penjualan.deleted_at) {
    throw new Error("Data penjualan tidak ditemukan.");
  }

  const { date: parsed_date } = get_date_boundaries(date);

  const existing_relation = existing_penjualan.outlet_insanku;
  const same_assignment =
    existing_relation?.uuid_outlet === trimmed_outlet_uuid &&
    existing_relation?.uuid_insanku === trimmed_employee_uuid;
  const outlet_insanku = same_assignment
    ? existing_relation
    : await prisma.tbl_outlet_insanku.findFirst({
        where: {
          uuid_outlet: trimmed_outlet_uuid,
          uuid_insanku: trimmed_employee_uuid,
          deleted_at: null,
          outlet: {
            deleted_at: null,
            is_active: true,
            excep: false,
          },
          insanku: {
            deleted_at: null,
          },
        },
        select: {
          uuid: true,
          inactive_periods: {
            where: { deleted_at: null },
            select: { start_date: true, end_date: true },
          },
          insanku: {
            select: {
              name: true,
              inactive_periods: {
                where: { deleted_at: null },
                select: { start_date: true, end_date: true },
              },
              gofitku_exclusion_periods: {
                where: {
                  deleted_at: null,
                },
                select: {
                  start_date: true,
                  end_date: true,
                },
              },
            },
          },
        },
      });

  if (!outlet_insanku) {
    throw new Error("InsanKu tidak terhubung dengan outlet yang dipilih.");
  }

  if (outlet_insanku.deleted_at && parsed_date > outlet_insanku.deleted_at) {
    throw new Error("Penjualan tidak dapat dipindah ke tanggal setelah penempatan berakhir.");
  }

  if (
    isDateInInactivePeriods(parsed_date, outlet_insanku.inactive_periods) ||
    isDateInInactivePeriods(parsed_date, outlet_insanku.insanku?.inactive_periods)
  ) {
    throw new Error(
      `${outlet_insanku.insanku?.name ?? "InsanKu"} tidak aktif pada tanggal tersebut.`,
    );
  }

  if (
    is_date_in_gofitku_exclusion(
      parsed_date,
      outlet_insanku.insanku?.gofitku_exclusion_periods,
    )
  ) {
    throw new Error(
      `${outlet_insanku.insanku?.name ?? "InsanKu"} sedang dikecualikan dari Penjualan GoFitKu pada tanggal tersebut.`,
    );
  }

  const product_row = trimmed_produk_uuid
    ? await prisma.tbl_produk_gofitku.findUnique({
        where: {
          uuid: trimmed_produk_uuid,
        },
        select: {
          uuid: true,
          name: true,
          deleted_at: true,
        },
      })
    : null;

  if (product_row && product_row.deleted_at) {
    throw new Error("Produk GoFitKu tidak ditemukan.");
  }

  const fallback_name = product_row?.name ?? trimmed_product_name;

  if (!fallback_name) {
    throw new Error("Nama produk wajib tersedia.");
  }

  await prisma.tbl_penjualan_gofitku.update({
    where: {
      uuid: trimmed_uuid,
    },
    data: {
      uuid_outlet_insanku: outlet_insanku.uuid,
      uuid_produk_gofitku: trimmed_produk_uuid || null,
      name: fallback_name,
      date: parsed_date,
      qty: Math.max(0, Math.trunc(normalized_sales_total)),
    },
  });

  return {
    success: true,
    message: "Penjualan GoFitKu berhasil diperbarui.",
  };
}

export async function deletePenjualanGofitku({
  uuid_penjualan_gofitku,
  outlet_uuid,
  account_uuid,
  role,
}) {
  const trimmed_uuid = String(uuid_penjualan_gofitku ?? "").trim();
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();

  if (!trimmed_uuid) {
    throw new Error("UUID penjualan wajib diisi.");
  }

  if (trimmed_outlet_uuid) {
    await assert_outlet_access({
      outlet_uuid: trimmed_outlet_uuid,
      account_uuid,
      role,
    });
  }

  const existing_penjualan = await prisma.tbl_penjualan_gofitku.findFirst({
    where: {
      uuid: trimmed_uuid,
      deleted_at: null,
      ...(trimmed_outlet_uuid
        ? {
            outlet_insanku: {
              uuid_outlet: trimmed_outlet_uuid,
            },
          }
        : {}),
    },
    select: {
      uuid: true,
    },
  });

  if (!existing_penjualan) {
    throw new Error("Data penjualan tidak ditemukan.");
  }

  await prisma.tbl_penjualan_gofitku.update({
    where: {
      uuid: trimmed_uuid,
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: "Penjualan GoFitKu berhasil dihapus.",
  };
}
const exec_file = promisify(execFile);
const invalid_excel_format_message =
  "Format Excel tidak sesuai. Pastikan file .xlsx memiliki kolom InsanKU atau NIK, serta kolom target.";

function normalize_target_insanku_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "");
}

function parse_target_date(date, {
  label = "Tanggal target",
} = {}) {
  const trimmed_date = String(date ?? "").trim();

  if (!trimmed_date) {
    throw new Error(`${label} wajib diisi.`);
  }

  const parsed_date = new Date(`${trimmed_date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed_date.getTime()) ||
    parsed_date.toISOString().slice(0, 10) != trimmed_date
  ) {
    throw new Error(`${label} tidak valid.`);
  }

  return parsed_date;
}

function parse_target_value(target, {
  label = "Nilai target",
} = {}) {
  const normalized_target = String(target ?? "").trim();

  if (!normalized_target) {
    throw new Error(`${label} wajib diisi.`);
  }

  const parsed_target = Number(normalized_target);

  if (!Number.isInteger(parsed_target) || parsed_target < 0) {
    throw new Error(`${label} harus berupa angka bulat nol atau lebih.`);
  }

  return parsed_target;
}

function assert_valid_range(start_date, end_date) {
  if (end_date < start_date) {
    throw new Error("Tanggal akhir tidak boleh lebih kecil dari tanggal awal.");
  }
}

async function parse_target_report_workbook(file_path) {
  try {
    const parser_path = path.join(process.cwd(), "src/scripts/parse_target_report.py");
    const { stdout, stderr } = await exec_file(
      "python3",
      [parser_path, file_path, "insanku"],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    if (stderr && stderr.trim()) {
      throw new Error(stderr.trim());
    }

    const payload = JSON.parse(stdout);

    if (!Array.isArray(payload?.rows)) {
      throw new Error("Format hasil pembacaan file target tidak valid.");
    }

    return payload.rows;
  } catch {
    throw new Error(invalid_excel_format_message);
  }
}

function format_target_placement_label(item) {
  const insanku_name = item.insanku?.name ?? "InsanKU tidak diketahui";
  const outlet_name = item.outlet?.name ?? "Outlet tidak diketahui";

  return `${insanku_name} - ${outlet_name}`;
}

function add_to_lookup(lookup, key, item) {
  if (!key) {
    return;
  }

  const matches = lookup.get(key) ?? [];
  matches.push(item);
  lookup.set(key, matches);
}

async function get_target_placement_maps() {
  const placement_rows = await prisma.tbl_outlet_insanku.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      outlet: {
        deleted_at: null,
        is_active: true,
        excep: false,
      },
      insanku: {
        deleted_at: null,
        is_active: true,
        is_slip_gaji_account: true,
      },
    },
    orderBy: [
      { insanku: { name: "asc" } },
      { outlet: { name: "asc" } },
    ],
    select: {
      uuid: true,
      uuid_insanku: true,
      uuid_outlet: true,
      outlet: { select: { uuid: true, name: true } },
      insanku: { select: { uuid: true, nik: true, name: true } },
    },
  });
  const placement_by_name = new Map();
  const placement_by_nik = new Map();
  const placement_by_outlet_and_name = new Map();
  const placement_by_outlet_and_nik = new Map();

  for (const item of placement_rows) {
    const normalized_name = normalize_target_insanku_name(item.insanku?.name);
    const normalized_outlet = normalize_target_insanku_name(item.outlet?.name);
    const nik = String(item.insanku?.nik ?? "").trim();

    item.placement_name = format_target_placement_label(item);
    add_to_lookup(
      placement_by_name,
      normalized_name,
      item,
    );
    add_to_lookup(placement_by_nik, nik, item);
    add_to_lookup(
      placement_by_outlet_and_name,
      `${normalized_outlet}:${normalized_name}`,
      item,
    );
    add_to_lookup(
      placement_by_outlet_and_nik,
      `${normalized_outlet}:${nik}`,
      item,
    );
  }

  return {
    placement_rows,
    placement_by_uuid: new Map(placement_rows.map((item) => [item.uuid, item])),
    placement_by_name,
    placement_by_nik,
    placement_by_outlet_and_name,
    placement_by_outlet_and_nik,
  };
}

function get_source_end_date_filter(source_start_date, source_end_date) {
  if (source_start_date.getTime() === source_end_date.getTime()) {
    return [
      { end_date: source_end_date },
      { end_date: null },
    ];
  }

  return [{ end_date: source_end_date }];
}

async function bulkUpdateTargetDates({
  source_start_date,
  source_end_date,
  start_date,
  end_date,
  target,
}) {
  const parsed_source_start_date = parse_target_date(source_start_date, {
    label: "Tanggal mulai lama",
  });
  const parsed_source_end_date = parse_target_date(source_end_date, {
    label: "Tanggal selesai lama",
  });
  const parsed_start_date = parse_target_date(start_date, {
    label: "Tanggal mulai baru",
  });
  const parsed_end_date = parse_target_date(end_date, {
    label: "Tanggal selesai baru",
  });
  const parsed_target = parse_target_value(target);

  assert_valid_range(parsed_source_start_date, parsed_source_end_date);
  assert_valid_range(parsed_start_date, parsed_end_date);

  const { placement_by_uuid } = await get_target_placement_maps();

  return prisma.$transaction(async (transaction) => {
    const target_model = transaction.tbl_target_gofitku;
    const selected_targets = await target_model.findMany({
      where: {
        deleted_at: null,
        uuid_outlet_insanku: { not: null },
        start_date: parsed_source_start_date,
        OR: get_source_end_date_filter(
          parsed_source_start_date,
          parsed_source_end_date,
        ),
      },
      select: {
        uuid: true,
        uuid_outlet_insanku: true,
      },
    });

    if (!selected_targets.length) {
      throw new Error("Data target pada periode lama tidak ditemukan.");
    }

    const selected_uuids = selected_targets.map((item) => item.uuid);
    const placement_uuids = Array.from(
      new Set(
        selected_targets
          .map((item) => item.uuid_outlet_insanku)
          .filter(Boolean),
      ),
    );
    const overlapping_targets = placement_uuids.length
      ? await target_model.findMany({
          where: {
            deleted_at: null,
            uuid: {
              notIn: selected_uuids,
            },
            uuid_outlet_insanku: {
              in: placement_uuids,
            },
            start_date: {
              lte: parsed_end_date,
            },
            OR: [
              { end_date: null },
              {
                end_date: {
                  gte: parsed_start_date,
                },
              },
            ],
          },
          select: {
            uuid_outlet_insanku: true,
          },
        })
      : [];

    if (overlapping_targets.length) {
      const overlapping_placement_names = Array.from(
        new Set(
          overlapping_targets
            .map((item) =>
              placement_by_uuid.get(
                String(item.uuid_outlet_insanku ?? "").trim(),
              )?.placement_name,
            )
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "id-ID"));

      throw new Error(
        `Edit massal dibatalkan karena tanggal baru bentrok untuk penempatan: ${overlapping_placement_names.join(", ")}.`,
      );
    }

    const result = await target_model.updateMany({
      where: {
        uuid: {
          in: selected_uuids,
        },
        deleted_at: null,
      },
      data: {
        start_date: parsed_start_date,
        end_date: parsed_end_date,
        value: parsed_target,
      },
    });

    return {
      success: true,
      message: `Tanggal dan target GoFitKu berhasil diperbarui untuk ${result.count} penempatan.`,
      data: {
        updated_count: result.count,
        start_date: parsed_start_date.toISOString().slice(0, 10),
        end_date: parsed_end_date.toISOString().slice(0, 10),
        target: parsed_target,
      },
    };
  });
}

async function bulkDeleteTargetPeriod({
  source_start_date,
  source_end_date,
}) {
  const parsed_source_start_date = parse_target_date(source_start_date, {
    label: "Tanggal mulai target",
  });
  const parsed_source_end_date = parse_target_date(source_end_date, {
    label: "Tanggal selesai target",
  });

  assert_valid_range(parsed_source_start_date, parsed_source_end_date);

  return prisma.$transaction(async (transaction) => {
    const target_model = transaction.tbl_target_gofitku;
    const selected_targets = await target_model.findMany({
      where: {
        deleted_at: null,
        uuid_outlet_insanku: { not: null },
        start_date: parsed_source_start_date,
        OR: get_source_end_date_filter(
          parsed_source_start_date,
          parsed_source_end_date,
        ),
      },
      select: {
        uuid: true,
      },
    });

    if (!selected_targets.length) {
      throw new Error("Data target pada periode terpilih tidak ditemukan.");
    }

    const result = await target_model.updateMany({
      where: {
        uuid: {
          in: selected_targets.map((item) => item.uuid),
        },
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return {
      success: true,
      message: `Target GoFitKu berhasil dihapus untuk ${result.count} penempatan.`,
      data: {
        deleted_count: result.count,
      },
    };
  });
}

function format_target_row(item, placement_by_uuid) {
  const placement = placement_by_uuid.get(
    String(item.uuid_outlet_insanku ?? "").trim(),
  );

  return {
    uuid: item.uuid,
    uuid_outlet_insanku: item.uuid_outlet_insanku ?? "",
    uuid_insanku: placement?.insanku?.uuid ?? "",
    uuid_outlet: placement?.outlet?.uuid ?? "",
    placement_name: placement?.placement_name ?? "Penempatan tidak diketahui",
    insanku_name: placement?.insanku?.name ?? "InsanKU tidak diketahui",
    outlet_name: placement?.outlet?.name ?? "Outlet tidak diketahui",
    nik: placement?.insanku?.nik ?? "",
    target: Number(item.value ?? 0),
    start_date: item.start_date.toISOString().slice(0, 10),
    end_date: item.end_date
      ? item.end_date.toISOString().slice(0, 10)
      : item.start_date.toISOString().slice(0, 10),
  };
}

async function find_overlapping_target({
  uuid_outlet_insanku,
  start_date,
  end_date,
  exclude_uuid,
}) {
  return prisma.tbl_target_gofitku.findFirst({
    where: {
      deleted_at: null,
      uuid_outlet_insanku,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      start_date: {
        lte: end_date,
      },
      OR: [
        {
          end_date: null,
        },
        {
          end_date: {
            gte: start_date,
          },
        },
      ],
    },
    select: {
      uuid: true,
      start_date: true,
      end_date: true,
    },
  });
}

async function assert_valid_placement_uuid(
  uuid_outlet_insanku,
  placement_by_uuid,
) {
  const trimmed_uuid_outlet_insanku = String(uuid_outlet_insanku ?? "").trim();

  if (!trimmed_uuid_outlet_insanku) {
    throw new Error("Penempatan wajib dipilih.");
  }

  if (!placement_by_uuid.has(trimmed_uuid_outlet_insanku)) {
    throw new Error("Penempatan target tidak ditemukan.");
  }

  return trimmed_uuid_outlet_insanku;
}

export async function getTargetGofitku() {
  const { placement_rows, placement_by_uuid } = await get_target_placement_maps();
  const data_target_gofitku = await prisma.tbl_target_gofitku.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: [
      {
        start_date: "desc",
      },
      {
        created_at: "desc",
      },
    ],
    select: {
      uuid: true,
      uuid_outlet_insanku: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    data_target_gofitku: data_target_gofitku
      .filter((item) =>
        placement_by_uuid.has(String(item.uuid_outlet_insanku ?? "").trim()),
      )
      .map((item) => format_target_row(item, placement_by_uuid)),
    options: placement_rows.map((item) => ({
      value: item.uuid,
      label: item.insanku?.nik
        ? `${item.placement_name} (${item.insanku.nik})`
        : item.placement_name,
      uuid_insanku: item.insanku?.uuid ?? "",
      insanku_name: item.insanku?.name ?? "",
      uuid_outlet: item.outlet?.uuid ?? "",
      outlet_name: item.outlet?.name ?? "",
    })),
  };
}

export async function createTargetGofitku({
  uuid_outlet_insanku,
  target,
  start_date,
  end_date,
}) {
  const { placement_by_uuid } = await get_target_placement_maps();
  const parsed_target = parse_target_value(target);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet_insanku = await assert_valid_placement_uuid(
    uuid_outlet_insanku,
    placement_by_uuid,
  );

  assert_valid_range(parsed_start_date, parsed_end_date);

  const overlapping_target = await find_overlapping_target({
    uuid_outlet_insanku: resolved_uuid_outlet_insanku,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
  });

  if (overlapping_target) {
    throw new Error("Rentang target bentrok dengan data target lain yang sudah ada.");
  }

  const created_target = await prisma.tbl_target_gofitku.create({
    data: {
      uuid: randomUUID(),
      uuid_outlet_insanku: resolved_uuid_outlet_insanku,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      uuid_outlet_insanku: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    data: format_target_row(created_target, placement_by_uuid),
    message: "Target GoFitKu berhasil ditambahkan.",
  };
}

export async function bulkCreateTargetGofitku({
  target,
  start_date,
  end_date,
}) {
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const parsed_target = parse_target_value(target);

  assert_valid_range(parsed_start_date, parsed_end_date);

  const { placement_rows } = await get_target_placement_maps();

  if (!placement_rows.length) {
    throw new Error("Tidak ada penempatan aktif yang dapat diberikan target.");
  }

  const normalized_items = placement_rows.map((item) => ({
    uuid: randomUUID(),
    uuid_outlet_insanku: item.uuid,
    value: parsed_target,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
  }));

  const { created_count, replaced_count } = await prisma.$transaction(
    async (transaction) => {
      const replaced_targets = await transaction.tbl_target_gofitku.updateMany({
        where: {
          deleted_at: null,
          uuid_outlet_insanku: {
            in: normalized_items.map((item) => item.uuid_outlet_insanku),
          },
          start_date: {
            lte: parsed_end_date,
          },
          OR: [
            { end_date: null },
            {
              end_date: {
                gte: parsed_start_date,
              },
            },
          ],
        },
        data: {
          deleted_at: new Date(),
        },
      });

      const result = await transaction.tbl_target_gofitku.createMany({
        data: normalized_items,
      });

      return {
        created_count: result.count,
        replaced_count: replaced_targets.count,
      };
    },
  );

  return {
    success: true,
    message: `${created_count} target GoFitKu berhasil disimpan secara massal${replaced_count ? ` dan ${replaced_count} data lama ditimpa` : ""}.`,
    data: {
      created_count,
      replaced_count,
    },
  };
}

export async function updateTargetGofitku({
  uuid_target_gofitku,
  uuid_outlet_insanku,
  target,
  start_date,
  end_date,
}) {
  if (!uuid_target_gofitku) {
    throw new Error("UUID target wajib diisi.");
  }

  const { placement_by_uuid } = await get_target_placement_maps();
  const parsed_target = parse_target_value(target);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet_insanku = await assert_valid_placement_uuid(
    uuid_outlet_insanku,
    placement_by_uuid,
  );

  assert_valid_range(parsed_start_date, parsed_end_date);

  const existing_target = await prisma.tbl_target_gofitku.findUnique({
    where: {
      uuid: uuid_target_gofitku,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_target || existing_target.deleted_at) {
    throw new Error("Data target tidak ditemukan.");
  }

  const overlapping_target = await find_overlapping_target({
    uuid_outlet_insanku: resolved_uuid_outlet_insanku,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
    exclude_uuid: uuid_target_gofitku,
  });

  if (overlapping_target) {
    throw new Error("Rentang target bentrok dengan data target lain yang sudah ada.");
  }

  const updated_target = await prisma.tbl_target_gofitku.update({
    where: {
      uuid: uuid_target_gofitku,
    },
    data: {
      uuid_outlet_insanku: resolved_uuid_outlet_insanku,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      uuid_outlet_insanku: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    data: format_target_row(updated_target, placement_by_uuid),
    message: "Target GoFitKu berhasil diperbarui.",
  };
}

export async function deleteTargetGofitku({ uuid_target_gofitku }) {
  if (!uuid_target_gofitku) {
    throw new Error("UUID target wajib diisi.");
  }

  const existing_target = await prisma.tbl_target_gofitku.findUnique({
    where: {
      uuid: uuid_target_gofitku,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_target || existing_target.deleted_at) {
    throw new Error("Data target tidak ditemukan.");
  }

  await prisma.tbl_target_gofitku.update({
    where: {
      uuid: uuid_target_gofitku,
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: "Target GoFitKu berhasil dihapus.",
  };
}

export async function importTargetGofitku({
  file_path,
  start_date,
  end_date,
}) {
  const parsed_start_date = parse_target_date(start_date, {
    label: "Tanggal mulai",
  });
  const parsed_end_date = parse_target_date(end_date, {
    label: "Tanggal selesai",
  });

  assert_valid_range(parsed_start_date, parsed_end_date);

  const rows = await parse_target_report_workbook(file_path);
  const {
    placement_by_name,
    placement_by_nik,
    placement_by_outlet_and_name,
    placement_by_outlet_and_nik,
  } = await get_target_placement_maps();
  const imported_rows = [];
  const unmatched_placements = [];
  const ambiguous_placements = [];
  const duplicate_placements = new Set();
  const seen_placement_uuids = new Set();

  for (const row of rows) {
    const insanku_name = String(row?.insanku_name ?? "").trim();
    const nik = String(row?.nik ?? "").trim();
    const outlet_name = String(row?.outlet_name ?? "").trim();

    if (!insanku_name && !nik) {
      continue;
    }

    const normalized_outlet_name = normalize_target_insanku_name(outlet_name);
    const normalized_insanku_name = normalize_target_insanku_name(insanku_name);
    const matches = outlet_name
      ? nik
        ? placement_by_outlet_and_nik.get(`${normalized_outlet_name}:${nik}`) ?? []
        : placement_by_outlet_and_name.get(
            `${normalized_outlet_name}:${normalized_insanku_name}`,
          ) ?? []
      : nik
        ? placement_by_nik.get(nik) ?? []
        : placement_by_name.get(normalized_insanku_name) ?? [];
    const source_label = outlet_name
      ? `${nik || insanku_name} - ${outlet_name}`
      : nik || insanku_name;

    if (!matches.length) {
      unmatched_placements.push(source_label);
      continue;
    }

    if (matches.length > 1) {
      ambiguous_placements.push(source_label);
      continue;
    }

    const matched_placement = matches[0];

    if (seen_placement_uuids.has(matched_placement.uuid)) {
      duplicate_placements.add(matched_placement.placement_name);
      continue;
    }

    seen_placement_uuids.add(matched_placement.uuid);
    const parsed_target = parse_target_value(row?.target, {
      label: `Nilai target untuk penempatan ${matched_placement.placement_name}`,
    });

    imported_rows.push({
      uuid: randomUUID(),
      uuid_outlet_insanku: matched_placement.uuid,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    });
  }

  if (ambiguous_placements.length) {
    throw new Error(
      `Beberapa penempatan tidak unik. Gunakan kolom Outlet dan NIK untuk: ${Array.from(new Set(ambiguous_placements))
        .sort((a, b) => a.localeCompare(b, "id-ID"))
        .join(", ")}.`,
    );
  }

  if (duplicate_placements.size) {
    throw new Error(
      `File impor memiliki penempatan duplikat: ${Array.from(duplicate_placements)
        .sort((a, b) => a.localeCompare(b, "id-ID"))
        .join(", ")}.`,
    );
  }

  if (!imported_rows.length) {
    throw new Error("Tidak ada data target penempatan yang cocok untuk diimpor.");
  }

  const replaced_count = await prisma.$transaction(async (transaction) => {
    const replaced_targets = await transaction.tbl_target_gofitku.updateMany({
      where: {
        deleted_at: null,
        uuid_outlet_insanku: {
          in: imported_rows.map((item) => item.uuid_outlet_insanku),
        },
        start_date: {
          lte: parsed_end_date,
        },
        OR: [
          {
            end_date: null,
          },
          {
            end_date: {
              gte: parsed_start_date,
            },
          },
        ],
      },
      data: {
        deleted_at: new Date(),
      },
    });

    await transaction.tbl_target_gofitku.createMany({
      data: imported_rows,
    });

    return replaced_targets.count;
  });

  return {
    success: true,
    message: `Impor target GoFitKu berhasil untuk ${imported_rows.length} penempatan${replaced_count ? ` dan ${replaced_count} data lama ditimpa` : ""}.`,
    data: {
      imported_count: imported_rows.length,
      replaced_count,
      unmatched_insanku: unmatched_placements,
      unmatched_placements,
      start_date: parsed_start_date.toISOString().slice(0, 10),
      end_date: parsed_end_date.toISOString().slice(0, 10),
    },
  };
}

export function bulkUpdateTargetGofitkuDates(payload) {
  return bulkUpdateTargetDates(payload);
}

export function bulkDeleteTargetGofitku(payload) {
  return bulkDeleteTargetPeriod(payload);
}
