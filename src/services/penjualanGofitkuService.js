import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";

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

  return {
    normalized_date,
    date,
    day_end,
    month_start,
    month_end,
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

async function get_member_outlet_uuids(username) {
  const trimmed_username = String(username ?? "").trim();

  if (!trimmed_username) {
    return [];
  }

  const member_relations = await prisma.tbl_outlet_insanku.findMany({
    where: {
      deleted_at: null,
      outlet: {
        deleted_at: null,
        excep: false,
      },
      insanku: {
        deleted_at: null,
        username: trimmed_username,
      },
    },
    select: {
      uuid_outlet: true,
    },
  });

  return Array.from(
    new Set(
      member_relations
        .map((item) => String(item.uuid_outlet ?? "").trim())
        .filter(Boolean),
    ),
  );
}

async function get_accessible_outlet_uuids({ username, role }) {
  const normalized_role = String(role ?? "").trim().toLowerCase();
  const trimmed_username = String(username ?? "").trim();

  if (normalized_role !== "member" || !trimmed_username) {
    return null;
  }

  return get_member_outlet_uuids(trimmed_username);
}

async function assert_outlet_access({ outlet_uuid, username, role }) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    username,
    role,
  });

  if (
    accessible_outlet_uuids &&
    !accessible_outlet_uuids.includes(outlet_uuid)
  ) {
    throw new Error("Outlet tidak dapat diakses.");
  }
}

async function get_outlet_insanku_rows(accessible_outlet_uuids) {
  return prisma.tbl_outlet_insanku.findMany({
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
    select: {
      uuid: true,
      uuid_outlet: true,
      uuid_insanku: true,
      outlet: {
        select: {
          uuid: true,
          name: true,
          category: true,
        },
      },
      insanku: {
        select: {
          uuid: true,
          name: true,
        },
      },
    },
  });
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
  username,
  role,
}) {
  const { date: selected_date, day_end, month_start, month_end } =
    get_date_boundaries(date);
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();
  const member_outlet_uuids = await get_accessible_outlet_uuids({
    username,
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

  const outlet_insanku_rows = await get_outlet_insanku_rows(
    accessible_outlet_uuids,
  );
  const active_targets = await prisma.tbl_target_gofitku.findMany({
    where: {
      deleted_at: null,
      ...(accessible_outlet_uuids
        ? {
            uuid_outlet: {
              in: accessible_outlet_uuids,
            },
          }
        : {}),
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
      uuid_outlet: true,
      value: true,
    },
  });
  const active_target_map = new Map();

  for (const item of active_targets) {
    const uuid_outlet = String(item.uuid_outlet ?? "").trim();

    if (!uuid_outlet || active_target_map.has(uuid_outlet)) {
      continue;
    }

    active_target_map.set(uuid_outlet, item.value ?? 0);
  }

  const relation_uuid_set = outlet_insanku_rows.map((item) => item.uuid);
  const sales_rows = relation_uuid_set.length
    ? await prisma.tbl_penjualan_gofitku.findMany({
        where: {
          deleted_at: null,
          uuid_outlet_insanku: {
            in: relation_uuid_set,
          },
          date: {
            gte: month_start,
            lt: month_end,
          },
        },
        orderBy: [
          {
            date: "asc",
          },
          {
            created_at: "asc",
          },
        ],
        select: {
          uuid: true,
          uuid_outlet_insanku: true,
          uuid_produk_gofitku: true,
          name: true,
          qty: true,
          date: true,
        },
      })
    : [];
  
  const today_sales = sales_rows.filter((item) => {
    const current_date = new Date(item.date);
    return current_date >= selected_date && current_date < day_end;
  });
  const summary_map = new Map();
  
  for (const relation of outlet_insanku_rows) {
    summary_map.set(relation.uuid, {
      uuid: relation.uuid_insanku ?? relation.uuid,
      name: relation.insanku?.name ?? "-",
      today_input: 0,
      monthly_total: 0,
      daily_totals: {},
      target: active_target_map.get(relation.uuid_outlet) ?? 0,
    });
  }
  
  for (const sale of sales_rows) {
    const current_summary = summary_map.get(sale.uuid_outlet_insanku);
  
    if (!current_summary) {
      continue;
    }
  
    current_summary.monthly_total += Number(sale.qty || 0);
  
    const sale_day = new Date(sale.date).getUTCDate();
    current_summary.daily_totals[sale_day] =
      Number(current_summary.daily_totals[sale_day] || 0) + Number(sale.qty || 0);
  }
  
  for (const sale of today_sales) {
    const current_summary = summary_map.get(sale.uuid_outlet_insanku);
  
    if (!current_summary) {
      continue;
    }
  
    current_summary.today_input += Number(sale.qty || 0);
  }
  
  const groups_map = new Map();
  
  for (const relation of outlet_insanku_rows) {
    if (!groups_map.has(relation.uuid_outlet)) {
      groups_map.set(relation.uuid_outlet, {
        uuid: relation.outlet?.uuid ?? relation.uuid_outlet,
        outlet_name: relation.outlet?.name ?? "-",
        kategori: relation.outlet?.category ?? null,
        rows: [],
        detail_rows: [],
      });
    }
  
    groups_map.get(relation.uuid_outlet).rows.push(summary_map.get(relation.uuid));
  }
  
  const relation_map = new Map(outlet_insanku_rows.map((item) => [item.uuid, item]));
  
  for (const sale of today_sales) {
    const relation = relation_map.get(sale.uuid_outlet_insanku);
  
    if (!relation) {
      continue;
    }
  
    const current_group = groups_map.get(relation.uuid_outlet);
  
    if (!current_group) {
      continue;
    }
  
    current_group.detail_rows.push({
      uuid: sale.uuid,
      employee_uuid: relation.uuid_insanku ?? "",
      name: relation.insanku?.name ?? "-",
      product_name: sale.name ?? "-",
      produk_uuid: sale.uuid_produk_gofitku ?? "",
      today_input: Number(sale.qty || 0),
      date: new Date(sale.date).toISOString().slice(0, 10),
    });
  }
  
  return {
    outlet_groups: Array.from(groups_map.values()),
  };
}

export async function getPenjualanGofitkuExport({ username, role }) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    username,
    role,
  });

  if (accessible_outlet_uuids && !accessible_outlet_uuids.length) {
    return {
      outlet_groups: [],
    };
  }

  const outlet_insanku_rows = await get_outlet_insanku_rows(
    accessible_outlet_uuids,
  );
  const relation_uuid_set = outlet_insanku_rows.map((item) => item.uuid);
  const sales_rows = relation_uuid_set.length
    ? await prisma.tbl_penjualan_gofitku.findMany({
        where: {
          deleted_at: null,
          uuid_outlet_insanku: {
            in: relation_uuid_set,
          },
        },
        orderBy: [
          {
            date: "asc",
          },
          {
            created_at: "asc",
          },
        ],
        select: {
          uuid_outlet_insanku: true,
          qty: true,
          date: true,
        },
      })
    : [];
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
      ...(accessible_outlet_uuids
        ? {
            uuid_outlet: {
              in: accessible_outlet_uuids,
            },
          }
        : {}),
    },
    orderBy: {
      start_date: "desc",
    },
    select: {
      uuid_outlet: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });
  const relation_map = new Map(
    outlet_insanku_rows.map((item) => [item.uuid, item]),
  );
  const relations_by_outlet = new Map();
  const groups_map = new Map();
  
  for (const relation of outlet_insanku_rows) {
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
  
  const get_target_for_month = (uuid_outlet, month_start) => {
    const target = targets.find((item) => {
      if (String(item.uuid_outlet ?? "").trim() !== String(uuid_outlet ?? "").trim()) {
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
    const year = month_start.getUTCFullYear();
    const month = month_start.getUTCMonth() + 1;
    const total_days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const month_sales = sales_by_month.get(month_key) ?? [];
  
    for (const group of groups_map.values()) {
      const target = get_target_for_month(group.uuid, month_start);
      const group_relations = relations_by_outlet.get(group.uuid) ?? [];
      const row_map = new Map(
        group_relations.map((relation) => [
          relation.uuid,
          {
            uuid: relation.uuid_insanku ?? relation.uuid,
            name: relation.insanku?.name ?? "-",
            monthly_total: 0,
            daily_totals: {},
            target,
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
        target,
        rows: Array.from(row_map.values()),
      });
    }
  }
  
  return {
    outlet_groups: Array.from(groups_map.values()),
  };
}

export async function getPenjualanGofitkuTopOutletChart({
  username,
  role,
}) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    username,
    role,
  });

  if (accessible_outlet_uuids && !accessible_outlet_uuids.length) {
    return {
      chart_data: [],
    };
  }

  const outlet_insanku_rows = await prisma.tbl_outlet_insanku.findMany({
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
        excep: false,
      },
    },
    select: {
      uuid: true,
      uuid_outlet: true,
      outlet: {
        select: {
          uuid: true,
          name: true,
        },
      },
    },
  });
  const relation_uuid_set = outlet_insanku_rows.map((item) => item.uuid);
  const sales_totals = relation_uuid_set.length
    ? await prisma.tbl_penjualan_gofitku.groupBy({
        by: ["uuid_outlet_insanku"],
        where: {
          deleted_at: null,
          uuid_outlet_insanku: {
            in: relation_uuid_set,
          },
        },
        _sum: {
          qty: true,
        },
      })
    : [];
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
  
  return {
    chart_data: get_top_five_chart_rows(Array.from(outlet_chart_map.values())),
  };
}

export async function getPenjualanGofitkuTopProdukChart({
  username,
  role,
}) {
  const accessible_outlet_uuids = await get_accessible_outlet_uuids({
    username,
    role,
  });

  if (accessible_outlet_uuids && !accessible_outlet_uuids.length) {
    return {
      chart_data: [],
    };
  }

  const outlet_insanku_rows = await prisma.tbl_outlet_insanku.findMany({
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
        excep: false,
      },
    },
    select: {
      uuid: true,
    },
  });
  const relation_uuid_set = outlet_insanku_rows.map((item) => item.uuid);
  const product_totals = relation_uuid_set.length
    ? await prisma.tbl_penjualan_gofitku.groupBy({
        by: ["name"],
        where: {
          deleted_at: null,
          uuid_outlet_insanku: {
            in: relation_uuid_set,
          },
        },
        _sum: {
          qty: true,
        },
      })
    : [];
  
  return {
    chart_data: get_top_five_chart_rows(
      product_totals.map((item) => ({
        key: item.name ?? "-",
        label: item.name ?? "-",
        value: Number(item._sum.qty || 0),
      })),
    ),
  };
}

export async function createPenjualanGofitku({
  outlet_uuid,
  entries = [],
  username,
  role,
}) {
  const trimmed_outlet_uuid = String(outlet_uuid ?? "").trim();

  if (!trimmed_outlet_uuid) {
    throw new Error("Outlet wajib diisi.");
  }

  await assert_outlet_access({
    outlet_uuid: trimmed_outlet_uuid,
    username,
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
        excep: false,
      },
    },
    select: {
      uuid: true,
      uuid_insanku: true,
    },
  });

  const relation_map = new Map(
    outlet_insanku_rows.map((item) => [item.uuid_insanku, item.uuid]),
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
  username,
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
    username,
    role,
  });

  const existing_penjualan = await prisma.tbl_penjualan_gofitku.findUnique({
    where: {
      uuid: trimmed_uuid,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_penjualan || existing_penjualan.deleted_at) {
    throw new Error("Data penjualan tidak ditemukan.");
  }

  const outlet_insanku = await prisma.tbl_outlet_insanku.findFirst({
    where: {
      uuid_outlet: trimmed_outlet_uuid,
      uuid_insanku: trimmed_employee_uuid,
      deleted_at: null,
      outlet: {
        deleted_at: null,
        excep: false,
      },
    },
    select: {
      uuid: true,
    },
  });

  if (!outlet_insanku) {
    throw new Error("InsanKu tidak terhubung dengan outlet yang dipilih.");
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

  const { date: parsed_date } = get_date_boundaries(date);

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
  username,
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
      username,
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
  "Format Excel tidak sesuai yang diharapkan. Pastikan file .xlsx memiliki kolom outlet dan target.";

function normalize_target_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(ho\)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
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

function assert_valid_range(start_date, end_date) {
  if (end_date < start_date) {
    throw new Error("Tanggal akhir tidak boleh lebih kecil dari tanggal awal.");
  }
}

async function parse_target_report_workbook(file_path) {
  try {
    const parser_path = path.join(process.cwd(), "src/scripts/parse_target_report.py");
    const { stdout, stderr } = await exec_file("python3", [parser_path, file_path], {
      maxBuffer: 10 * 1024 * 1024,
    });

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

async function get_target_outlet_maps() {
  const outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      excep: false,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      uuid: true,
      name: true,
      category: true,
    },
  });

  return {
    outlet_by_uuid: new Map(outlets.map((item) => [item.uuid, item])),
    outlet_by_name: new Map(
      outlets.map((item) => [normalize_target_outlet_name(item.name), item]),
    ),
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
  model,
  label,
  source_start_date,
  source_end_date,
  start_date,
  end_date,
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

  assert_valid_range(parsed_source_start_date, parsed_source_end_date);
  assert_valid_range(parsed_start_date, parsed_end_date);

  const { outlet_by_uuid } = await get_target_outlet_maps();

  return prisma.$transaction(async (transaction) => {
    const target_model = transaction[model];
    const selected_targets = await target_model.findMany({
      where: {
        deleted_at: null,
        start_date: parsed_source_start_date,
        OR: get_source_end_date_filter(
          parsed_source_start_date,
          parsed_source_end_date,
        ),
      },
      select: {
        uuid: true,
        uuid_outlet: true,
      },
    });

    if (!selected_targets.length) {
      throw new Error("Data target pada periode lama tidak ditemukan.");
    }

    const selected_uuids = selected_targets.map((item) => item.uuid);
    const outlet_uuids = Array.from(
      new Set(selected_targets.map((item) => item.uuid_outlet).filter(Boolean)),
    );
    const overlapping_targets = outlet_uuids.length
      ? await target_model.findMany({
          where: {
            deleted_at: null,
            uuid: {
              notIn: selected_uuids,
            },
            uuid_outlet: {
              in: outlet_uuids,
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
            uuid_outlet: true,
          },
        })
      : [];

    if (overlapping_targets.length) {
      const overlapping_outlet_names = Array.from(
        new Set(
          overlapping_targets
            .map((item) =>
              outlet_by_uuid.get(String(item.uuid_outlet ?? "").trim())?.name,
            )
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "id-ID"));

      throw new Error(
        `Edit massal dibatalkan karena tanggal baru bentrok untuk outlet: ${overlapping_outlet_names.join(", ")}.`,
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
      },
    });

    return {
      success: true,
      message: `Tanggal ${label.toLowerCase()} berhasil diperbarui untuk ${result.count} outlet.`,
      data: {
        updated_count: result.count,
        start_date: parsed_start_date.toISOString().slice(0, 10),
        end_date: parsed_end_date.toISOString().slice(0, 10),
      },
    };
  });
}

async function bulkDeleteTargetPeriod({
  model,
  label,
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
    const target_model = transaction[model];
    const selected_targets = await target_model.findMany({
      where: {
        deleted_at: null,
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
      message: `${label} berhasil dihapus untuk ${result.count} outlet.`,
      data: {
        deleted_count: result.count,
      },
    };
  });
}

function format_target_row(item, outlet_by_uuid) {
  const outlet = outlet_by_uuid.get(String(item.uuid_outlet ?? "").trim());

  return {
    uuid: item.uuid,
    uuid_outlet: item.uuid_outlet ?? "",
    outlet_name: outlet?.name ?? "Outlet tidak diketahui",
    target: Number(item.value ?? 0),
    start_date: item.start_date.toISOString().slice(0, 10),
    end_date: item.end_date
      ? item.end_date.toISOString().slice(0, 10)
      : item.start_date.toISOString().slice(0, 10),
  };
}

async function find_overlapping_target({
  uuid_outlet,
  start_date,
  end_date,
  exclude_uuid,
}) {
  return prisma.tbl_target_gofitku.findFirst({
    where: {
      deleted_at: null,
      uuid_outlet,
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

async function assert_valid_outlet_uuid(uuid_outlet, outlet_by_uuid) {
  const trimmed_uuid_outlet = String(uuid_outlet ?? "").trim();

  if (!trimmed_uuid_outlet) {
    throw new Error("Outlet wajib dipilih.");
  }

  if (!outlet_by_uuid.has(trimmed_uuid_outlet)) {
    throw new Error("Outlet target tidak ditemukan.");
  }

  return trimmed_uuid_outlet;
}

export async function getTargetGofitku() {
  const { outlet_by_uuid } = await get_target_outlet_maps();
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
      uuid_outlet: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    data_target_gofitku: data_target_gofitku
      .filter((item) =>
        outlet_by_uuid.has(String(item.uuid_outlet ?? "").trim()),
      )
      .map((item) => format_target_row(item, outlet_by_uuid)),
  };
}

export async function createTargetGofitku({
  uuid_outlet,
  target,
  start_date,
  end_date,
}) {
  const { outlet_by_uuid } = await get_target_outlet_maps();
  const parsed_target = Number(target);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet = await assert_valid_outlet_uuid(uuid_outlet, outlet_by_uuid);

  if (!Number.isInteger(parsed_target) || parsed_target < 0) {
    throw new Error("Nilai target harus berupa angka bulat nol atau lebih.");
  }

  assert_valid_range(parsed_start_date, parsed_end_date);

  const overlapping_target = await find_overlapping_target({
    uuid_outlet: resolved_uuid_outlet,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
  });

  if (overlapping_target) {
    throw new Error("Range target bentrok dengan data target lain yang sudah ada.");
  }

  const created_target = await prisma.tbl_target_gofitku.create({
    data: {
      uuid: randomUUID(),
      uuid_outlet: resolved_uuid_outlet,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      uuid_outlet: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    data: format_target_row(created_target, outlet_by_uuid),
    message: "Target GoFitKu berhasil ditambahkan.",
  };
}

export async function updateTargetGofitku({
  uuid_target_gofitku,
  uuid_outlet,
  target,
  start_date,
  end_date,
}) {
  if (!uuid_target_gofitku) {
    throw new Error("UUID target wajib diisi.");
  }

  const { outlet_by_uuid } = await get_target_outlet_maps();
  const parsed_target = Number(target);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet = await assert_valid_outlet_uuid(uuid_outlet, outlet_by_uuid);

  if (!Number.isInteger(parsed_target) || parsed_target < 0) {
    throw new Error("Nilai target harus berupa angka bulat nol atau lebih.");
  }

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
    uuid_outlet: resolved_uuid_outlet,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
    exclude_uuid: uuid_target_gofitku,
  });

  if (overlapping_target) {
    throw new Error("Range target bentrok dengan data target lain yang sudah ada.");
  }

  const updated_target = await prisma.tbl_target_gofitku.update({
    where: {
      uuid: uuid_target_gofitku,
    },
    data: {
      uuid_outlet: resolved_uuid_outlet,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      uuid_outlet: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    data: format_target_row(updated_target, outlet_by_uuid),
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
  const { outlet_by_name, outlet_by_uuid } = await get_target_outlet_maps();
  const imported_rows = [];
  const unmatched_outlets = [];
  const duplicate_outlets = new Set();
  const seen_outlet_uuids = new Set();

  for (const row of rows) {
    const outlet_name = String(row?.outlet_name ?? "").trim();

    if (!outlet_name) {
      continue;
    }

    const matched_outlet = outlet_by_name.get(
      normalize_target_outlet_name(outlet_name),
    );

    if (!matched_outlet) {
      unmatched_outlets.push(outlet_name);
      continue;
    }

    if (seen_outlet_uuids.has(matched_outlet.uuid)) {
      duplicate_outlets.add(matched_outlet.name);
      continue;
    }

    seen_outlet_uuids.add(matched_outlet.uuid);
    const parsed_target = Number(String(row?.target ?? "").trim().replace(",", "."));

    if (!Number.isInteger(parsed_target) || parsed_target < 0) {
      throw new Error(`Nilai target untuk outlet ${matched_outlet.name} tidak valid.`);
    }

    imported_rows.push({
      uuid: randomUUID(),
      uuid_outlet: matched_outlet.uuid,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    });
  }

  if (duplicate_outlets.size) {
    throw new Error(
      `File impor memiliki outlet duplikat: ${Array.from(duplicate_outlets)
        .sort((a, b) => a.localeCompare(b, "id-ID"))
        .join(", ")}.`,
    );
  }

  if (!imported_rows.length) {
    throw new Error("Tidak ada data target outlet yang cocok untuk diimpor.");
  }

  const overlapping_targets = await prisma.tbl_target_gofitku.findMany({
    where: {
      deleted_at: null,
      uuid_outlet: {
        in: imported_rows.map((item) => item.uuid_outlet),
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
    select: {
      uuid_outlet: true,
    },
  });

  if (overlapping_targets.length) {
    const overlapping_outlet_names = Array.from(
      new Set(
        overlapping_targets
          .map((item) => outlet_by_uuid.get(String(item.uuid_outlet ?? "").trim())?.name)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "id-ID"));

    throw new Error(
      `Impor dibatalkan karena range target bentrok untuk outlet: ${overlapping_outlet_names.join(", ")}.`,
    );
  }

  await prisma.tbl_target_gofitku.createMany({
    data: imported_rows,
  });

  return {
    success: true,
    message: `Impor target GoFitKu berhasil untuk ${imported_rows.length} outlet.`,
    data: {
      imported_count: imported_rows.length,
      unmatched_outlets,
      start_date: parsed_start_date.toISOString().slice(0, 10),
      end_date: parsed_end_date.toISOString().slice(0, 10),
    },
  };
}

export function bulkUpdateTargetGofitkuDates(payload) {
  return bulkUpdateTargetDates({
    ...payload,
    model: "tbl_target_gofitku",
    label: "Target GoFitKu",
  });
}

export function bulkDeleteTargetGofitku(payload) {
  return bulkDeleteTargetPeriod({
    ...payload,
    model: "tbl_target_gofitku",
    label: "Target GoFitKu",
  });
}
