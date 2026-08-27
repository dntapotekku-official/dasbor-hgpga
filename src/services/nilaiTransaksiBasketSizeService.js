import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { outlet_category_slugs } from "@/lib/outletCategories";
import { prisma } from "@/lib/prisma";

const exec_file = promisify(execFile);

function start_of_month(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function end_of_month(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function normalize_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(ho\)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function resolve_month_label(date, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolve_month_name(date, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function resolve_date_label(date, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolve_period_label(start_date, end_date, locale = "id-ID") {
  return `${resolve_month_name(start_date, locale)} (1 - ${resolve_date_label(end_date, locale)})`;
}

function compare_percentage(value, divisor) {
  if (!divisor) {
    return 0;
  }

  return (value / divisor) * 100;
}

function to_number(value) {
  const parsed_value = Number(value ?? 0);

  return Number.isFinite(parsed_value) ? parsed_value : 0;
}

// Rumus NS
function build_nilai_transaksi_metrics({
  target,
  daily,
  last_month,
  current_month,
}) {
  const nt_target = Math.round(to_number(target));
  const nt_daily = Math.round(to_number(daily));
  const nt_last_month = Math.round(to_number(last_month));
  const nt_current_month = Math.round(to_number(current_month));
  const nt_growth = compare_percentage(nt_current_month, nt_last_month);
  const nt_gap_growth = nt_growth - 100;
  const nt_target_compare = compare_percentage(nt_current_month, nt_target);
  const nt_gap_target = nt_target_compare - 100;

  return {
    nt_target,
    nt_daily,
    nt_last_month,
    nt_current_month,
    nt_growth,
    nt_gap_growth,
    nt_target_compare,
    nt_gap_target,
  };
}

// Rumus BS
function build_basket_size_metrics({
  target,
  last_month,
  current_month,
}) {
  const bs_target = to_number(target);
  const bs_last_month = to_number(last_month);
  const bs_current_month = to_number(current_month);
  const bs_growth = compare_percentage(bs_current_month, bs_last_month);
  const bs_gap_growth = bs_growth - 100;
  const bs_target_compare = compare_percentage(bs_current_month, bs_target);
  const bs_gap_target = bs_target_compare - 100;

  return {
    bs_target,
    bs_last_month,
    bs_current_month,
    bs_growth,
    bs_gap_growth,
    bs_target_compare,
    bs_gap_target,
  };
}

async function parse_report_workbook(file_path) {
  const parser_path = path.join(process.cwd(), "src/scripts/parse_outlet_report.py");
  const { stdout, stderr } = await exec_file("python3", [parser_path, file_path], {
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stderr && stderr.trim()) {
    throw new Error(stderr.trim());
  }

  const payload = JSON.parse(stdout);

  if (!Array.isArray(payload?.rows)) {
    throw new Error("Format hasil pembacaan file tidak valid.");
  }

  return payload;
}

async function get_active_target_map({
  model,
  current_month_start,
  current_month_end,
}) {
  const targets = await prisma[model].findMany({
    where: {
      deleted_at: null,
      start_date: {
        lte: current_month_end,
      },
      OR: [
        {
          end_date: null,
        },
        {
          end_date: {
            gte: current_month_start,
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

  const target_map = new Map();

  for (const target of targets) {
    const uuid_outlet = String(target.uuid_outlet ?? "").trim();

    if (!uuid_outlet || target_map.has(uuid_outlet)) {
      continue;
    }

    target_map.set(uuid_outlet, target.value ?? 0);
  }

  return target_map;
}

function map_metric_rows({
  outlets,
  current_nilai_transaksi_map,
  current_month_nilai_transaksi_map,
  last_nilai_transaksi_map,
  current_basket_size_map,
  current_month_basket_size_map,
  last_basket_size_map,
  nilai_transaksi_target_map,
  basket_size_target_map,
}) {
  return outlets.map((outlet) => {
    const current_nilai_transaksi = current_nilai_transaksi_map.get(outlet.uuid) ?? 0;
    const current_month_nilai_transaksi =
      current_month_nilai_transaksi_map.get(outlet.uuid) ?? 0;
    const last_nilai_transaksi = last_nilai_transaksi_map.get(outlet.uuid) ?? 0;
    const current_basket_size = (current_basket_size_map.get(outlet.uuid) ?? 0) / 100;
    const current_month_basket_size =
      (current_month_basket_size_map.get(outlet.uuid) ?? 0) / 100;
    const last_basket_size = (last_basket_size_map.get(outlet.uuid) ?? 0) / 100;
    const nilai_transaksi_target = nilai_transaksi_target_map.get(outlet.uuid) ?? 0;
    const basket_size_target = basket_size_target_map.get(outlet.uuid) ?? 0;

    return {
      uuid: outlet.uuid,
      outlet_name: outlet.name,
      kategori: outlet.kategori,
      category_key: String(outlet.kategori ?? "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-"),
      ...build_nilai_transaksi_metrics({
        target: nilai_transaksi_target,
        daily: current_nilai_transaksi,
        last_month: last_nilai_transaksi,
        current_month: current_month_nilai_transaksi,
      }),
      ...build_basket_size_metrics({
        target: basket_size_target / 100,
        last_month: last_basket_size,
        current_month: current_month_basket_size,
      }),
    };
  });
}

function build_sum_map(rows) {
  const map = new Map();

  rows.forEach((item) => {
    if (!item.uuid_outlet) {
      return;
    }

    map.set(item.uuid_outlet, (map.get(item.uuid_outlet) ?? 0) + to_number(item.ach));
  });

  return map;
}

function parse_metric_date(value, label = "Tanggal") {
  const normalized_date = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized_date)) {
    throw new Error(`${label} wajib diisi dengan format yang valid.`);
  }

  const date = new Date(`${normalized_date}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized_date
  ) {
    throw new Error(`${label} tidak valid.`);
  }

  return date;
}

function end_of_day(date) {
  return new Date(date.getTime() + 86_400_000 - 1);
}

function map_available_dates(rows) {
  return Array.from(
    new Set(rows.map((item) => item.created_at.toISOString().slice(0, 10))),
  );
}

export async function getNilaiTransaksiBasketSize({
  selected_date,
}) {
  const trimmed_selected_date = String(selected_date ?? "").trim();
  const current_date = trimmed_selected_date
    ? new Date(`${trimmed_selected_date}T00:00:00.000Z`)
    : new Date();

  if (
    Number.isNaN(current_date.getTime()) ||
    (trimmed_selected_date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed_selected_date) ||
        current_date.toISOString().slice(0, 10) !== trimmed_selected_date))
  ) {
    throw new Error("Tanggal filter tidak valid.");
  }

  const current_month_start = start_of_month(current_date);
  const current_day_start = new Date(
    Date.UTC(
      current_date.getUTCFullYear(),
      current_date.getUTCMonth(),
      current_date.getUTCDate(),
    ),
  );
  const current_day_end = new Date(current_day_start.getTime() + 86_400_000 - 1);
  const current_month_end = current_day_end;
  const previous_month_start = start_of_month(
    new Date(Date.UTC(current_date.getUTCFullYear(), current_date.getUTCMonth() - 1, 1)),
  );
  const previous_month_end = end_of_month(previous_month_start);

  const [
    outlets,
    current_nilai_transaksi,
    current_month_nilai_transaksi,
    last_nilai_transaksi,
    current_basket_size,
    current_month_basket_size,
    last_basket_size,
    nilai_transaksi_target_map,
    basket_size_target_map,
    nilai_transaksi_dates,
    basket_size_dates,
  ] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uuid: true,
        name: true,
        kategori: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: current_day_start,
          lte: current_day_end,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: current_month_start,
          lte: current_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: previous_month_start,
          lte: previous_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: current_day_start,
          lte: current_day_end,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: current_month_start,
          lte: current_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: previous_month_start,
          lte: previous_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        ach: true,
      },
    }),
    get_active_target_map({
      model: "tbl_target_nilai_transaksi",
      current_month_start,
      current_month_end,
    }),
    get_active_target_map({
      model: "tbl_target_basket_size",
      current_month_start,
      current_month_end,
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
      distinct: ["created_at"],
      select: {
        created_at: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
      distinct: ["created_at"],
      select: {
        created_at: true,
      },
    }),
  ]);

  const current_nilai_transaksi_map = build_sum_map(current_nilai_transaksi);
  const current_month_nilai_transaksi_map = build_sum_map(current_month_nilai_transaksi);
  const last_nilai_transaksi_map = build_sum_map(last_nilai_transaksi);
  const current_basket_size_map = build_sum_map(current_basket_size);
  const current_month_basket_size_map = build_sum_map(current_month_basket_size);
  const last_basket_size_map = build_sum_map(last_basket_size);

  const rows = map_metric_rows({
    outlets,
    current_nilai_transaksi_map,
    current_month_nilai_transaksi_map,
    last_nilai_transaksi_map,
    current_basket_size_map,
    current_month_basket_size_map,
    last_basket_size_map,
    nilai_transaksi_target_map,
    basket_size_target_map,
  });
  const category_metrics = Object.fromEntries(
    outlet_category_slugs.map((category) => {
      const summary = rows
        .filter((row) => row.category_key === category)
        .reduce(
          (current, row) => ({
            nt_target: current.nt_target + row.nt_target,
            nt_daily: current.nt_daily + row.nt_daily,
            nt_last_month: current.nt_last_month + row.nt_last_month,
            nt_current_month: current.nt_current_month + row.nt_current_month,
            bs_target: current.bs_target + row.bs_target,
            bs_last_month: current.bs_last_month + row.bs_last_month,
            bs_current_month: current.bs_current_month + row.bs_current_month,
          }),
          {
            nt_target: 0,
            nt_daily: 0,
            nt_last_month: 0,
            nt_current_month: 0,
            bs_target: 0,
            bs_last_month: 0,
            bs_current_month: 0,
          },
        );

      return [
        category,
        {
          ...build_nilai_transaksi_metrics({
            target: summary.nt_target,
            daily: summary.nt_daily,
            last_month: summary.nt_last_month,
            current_month: summary.nt_current_month,
          }),
          ...build_basket_size_metrics({
            target: summary.bs_target,
            last_month: summary.bs_last_month,
            current_month: summary.bs_current_month,
          }),
        },
      ];
    }),
  );

  return {
    selected_month_label: resolve_month_label(current_date),
    previous_month_label: resolve_month_label(previous_month_start),
    selected_date_label: resolve_date_label(current_date),
    selected_period_label: resolve_period_label(current_month_start, current_date),
    previous_period_label: resolve_period_label(previous_month_start, previous_month_end),
    rows,
    category_metrics,
    available_dates: {
      nilai_transaksi: map_available_dates(nilai_transaksi_dates),
      basket_size: map_available_dates(basket_size_dates),
    },
  };
}

async function assert_active_outlet(uuid_outlet) {
  const normalized_uuid_outlet = String(uuid_outlet ?? "").trim();

  if (!normalized_uuid_outlet) {
    throw new Error("Outlet wajib dipilih.");
  }

  const outlet = await prisma.tbl_outlet.findFirst({
    where: {
      uuid: normalized_uuid_outlet,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (!outlet) {
    throw new Error("Outlet tidak ditemukan.");
  }

  return normalized_uuid_outlet;
}

export async function updateNilaiTransaksiDaily({
  uuid_outlet,
  selected_date,
  daily,
}) {
  const normalized_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const date = parse_metric_date(selected_date, "Tanggal data");
  const parsed_daily = Number(daily);

  if (!Number.isInteger(parsed_daily) || parsed_daily < 0) {
    throw new Error("Nilai harian harus berupa angka bulat nol atau lebih.");
  }

  return prisma.$transaction(async (transaction) => {
    const records = await transaction.tbl_nilai_transaksi.findMany({
      where: {
        uuid_outlet: normalized_uuid_outlet,
        deleted_at: null,
        created_at: {
          gte: date,
          lte: end_of_day(date),
        },
      },
      orderBy: {
        created_at: "asc",
      },
      select: {
        uuid: true,
      },
    });

    if (!records.length) {
      throw new Error("Data nilai transaksi harian outlet ini tidak ditemukan.");
    }

    await transaction.tbl_nilai_transaksi.update({
      where: {
        uuid: records[0].uuid,
      },
      data: {
        ach: parsed_daily,
      },
    });

    if (records.length > 1) {
      await transaction.tbl_nilai_transaksi.deleteMany({
        where: {
          uuid: {
            in: records.slice(1).map((item) => item.uuid),
          },
        },
      });
    }

    return {
      success: true,
      message: "Nilai transaksi harian berhasil diperbarui.",
    };
  });
}

async function delete_metric_daily({
  model,
  metric_label,
  uuid_outlet,
  selected_date,
}) {
  const normalized_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const date = parse_metric_date(selected_date, "Tanggal data");
  const result = await prisma[model].deleteMany({
    where: {
      uuid_outlet: normalized_uuid_outlet,
      deleted_at: null,
      created_at: {
        gte: date,
        lte: end_of_day(date),
      },
    },
  });

  if (!result.count) {
    throw new Error(`Data ${metric_label} outlet ini tidak ditemukan.`);
  }

  return {
    success: true,
    message: `${metric_label} outlet berhasil dihapus.`,
  };
}

async function bulk_delete_metric_date({
  model,
  metric_label,
  selected_date,
}) {
  const date = parse_metric_date(selected_date, "Tanggal data");
  const result = await prisma[model].deleteMany({
    where: {
      deleted_at: null,
      created_at: {
        gte: date,
        lte: end_of_day(date),
      },
    },
  });

  if (!result.count) {
    throw new Error(`Data ${metric_label} pada tanggal ini tidak ditemukan.`);
  }

  return {
    success: true,
    message: `${result.count} data outlet ${metric_label} berhasil dihapus.`,
    data: {
      deleted_count: result.count,
    },
  };
}

export async function bulkUpdateNilaiTransaksiDate({
  source_date,
  target_date,
}) {
  const parsed_source_date = parse_metric_date(source_date, "Tanggal lama");
  const parsed_target_date = parse_metric_date(target_date, "Tanggal baru");

  if (parsed_source_date.getTime() === parsed_target_date.getTime()) {
    throw new Error("Tanggal baru harus berbeda dari tanggal lama.");
  }

  return prisma.$transaction(async (transaction) => {
    const source_records = await transaction.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        created_at: {
          gte: parsed_source_date,
          lte: end_of_day(parsed_source_date),
        },
      },
      select: {
        uuid: true,
      },
    });

    if (!source_records.length) {
      throw new Error("Data nilai transaksi pada tanggal lama tidak ditemukan.");
    }

    const target_record = await transaction.tbl_nilai_transaksi.findFirst({
      where: {
        deleted_at: null,
        created_at: {
          gte: parsed_target_date,
          lte: end_of_day(parsed_target_date),
        },
      },
      select: {
        uuid: true,
      },
    });

    if (target_record) {
      throw new Error(
        "Edit massal dibatalkan karena tanggal baru sudah memiliki data nilai transaksi.",
      );
    }

    const result = await transaction.tbl_nilai_transaksi.updateMany({
      where: {
        uuid: {
          in: source_records.map((item) => item.uuid),
        },
      },
      data: {
        created_at: parsed_target_date,
      },
    });

    return {
      success: true,
      message: `Tanggal nilai transaksi berhasil diperbarui untuk ${result.count} outlet.`,
      data: {
        updated_count: result.count,
        target_date: parsed_target_date.toISOString().slice(0, 10),
      },
    };
  });
}

export function deleteNilaiTransaksiDaily(payload) {
  return delete_metric_daily({
    ...payload,
    model: "tbl_nilai_transaksi",
    metric_label: "Nilai transaksi",
  });
}

export function bulkDeleteNilaiTransaksiDate(payload) {
  return bulk_delete_metric_date({
    ...payload,
    model: "tbl_nilai_transaksi",
    metric_label: "nilai transaksi",
  });
}

export function deleteBasketSizeDaily(payload) {
  return delete_metric_daily({
    ...payload,
    model: "tbl_basket_size",
    metric_label: "Basket size",
  });
}

export function bulkDeleteBasketSizeDate(payload) {
  return bulk_delete_metric_date({
    ...payload,
    model: "tbl_basket_size",
    metric_label: "basket size",
  });
}

async function importOutletReportMetric({
  file_path,
  import_date,
  model,
  metric_key,
  metric_label,
}) {
  const normalized_import_date = String(import_date ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized_import_date)) {
    throw new Error("Tanggal impor wajib diisi dengan format yang valid.");
  }

  const report_date = new Date(`${normalized_import_date}T00:00:00.000Z`);

  if (
    Number.isNaN(report_date.getTime()) ||
    report_date.toISOString().slice(0, 10) !== normalized_import_date
  ) {
    throw new Error("Tanggal impor tidak valid.");
  }

  const report_day_end = new Date(report_date.getTime() + 86_400_000 - 1);
  const payload = await parse_report_workbook(file_path);
  const outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
    },
  });

  const outlet_map = new Map(
    outlets.map((outlet) => [normalize_outlet_name(outlet.name), outlet]),
  );
  const imported_rows = [];
  const unmatched_outlets = [];

  payload.rows.forEach((row) => {
    const matched_outlet = outlet_map.get(normalize_outlet_name(row.outlet_name));

    if (!matched_outlet) {
      unmatched_outlets.push(row.outlet_name);
      return;
    }

    const total_penerimaan_pendapatan = to_number(row.total_penerimaan_pendapatan);
    const dilayani = to_number(row.dilayani);

    if (!dilayani || !total_penerimaan_pendapatan) {
      return;
    }

    imported_rows.push({
      uuid_outlet: matched_outlet.uuid,
      outlet_name: matched_outlet.name,
      nilai_transaksi_daily: Math.round((total_penerimaan_pendapatan / dilayani) * 100),
      basket_size_daily: Math.round(dilayani * 100),
    });
  });

  if (!imported_rows.length) {
    throw new Error("Tidak ada data outlet yang cocok untuk diimpor.");
  }

  await prisma.$transaction(async (tx) => {
    await tx[model].deleteMany({
      where: {
        created_at: {
          gte: report_date,
          lte: report_day_end,
        },
      },
    });

    await tx[model].createMany({
      data: imported_rows.map((row) => ({
        uuid: randomUUID(),
        uuid_outlet: row.uuid_outlet,
        ach: row[metric_key],
        created_at: report_date,
      })),
    });
  });

  return {
    success: true,
    message: `Impor ${metric_label} berhasil untuk ${imported_rows.length} outlet.`,
    data: {
      imported_count: imported_rows.length,
      unmatched_outlets,
      import_date: normalized_import_date,
    },
  };
}

export function importNilaiTransaksi({
  file_path,
  import_date,
}) {
  return importOutletReportMetric({
    file_path,
    import_date,
    model: "tbl_nilai_transaksi",
    metric_key: "nilai_transaksi_daily",
    metric_label: "nilai transaksi",
  });
}

export function importBasketSize({
  file_path,
  import_date,
}) {
  return importOutletReportMetric({
    file_path,
    import_date,
    model: "tbl_basket_size",
    metric_key: "basket_size_daily",
    metric_label: "basket size",
  });
}
