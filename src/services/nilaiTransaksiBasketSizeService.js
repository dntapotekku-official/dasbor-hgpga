import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import ExcelJS from "exceljs";

import { outlet_category_slugs } from "@/lib/outletCategories";
import { prisma } from "@/lib/prisma";

// ============================================================================
// Konfigurasi dasar
// ============================================================================

const exec_file = promisify(execFile);

const empty_global_targets = {
  nilai_transaksi: 0,
  basket_size: 0,
};

const export_category_labels = {
  "non-pariwisata": "Non Pariwisata",
  pariwisata: "Pariwisata",
  parsial: "Parsial",
};

const export_columns = [
  { key: "number", width: 5 },
  { key: "outlet", width: 28 },
  { key: "category", width: 14 },
  { key: "nt_target", width: 14 },
  { key: "nt_daily", width: 15 },
  { key: "nt_last_month", width: 15 },
  { key: "nt_current_month", width: 15 },
  { key: "nt_growth", width: 14 },
  { key: "nt_gap_growth", width: 12 },
  { key: "nt_target_compare", width: 14 },
  { key: "nt_gap_target", width: 12 },
  { key: "bs_target", width: 12 },
  { key: "bs_last_month", width: 14 },
  { key: "bs_current_month", width: 14 },
  { key: "bs_growth", width: 14 },
  { key: "bs_gap_growth", width: 12 },
  { key: "bs_target_compare", width: 14 },
  { key: "bs_gap_target", width: 12 },
];

// ============================================================================
// Helper tanggal, label, angka, dan normalisasi teks
// ============================================================================

/** Menghasilkan tanggal awal bulan dalam zona waktu UTC. */
function start_of_month(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Menghasilkan tanggal akhir bulan beserta batas waktu hari terakhir dalam UTC. */
function end_of_month(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** Menormalkan nama outlet agar pencocokan data impor konsisten. */
function normalize_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    // Suffix seperti (HO) harus tetap dibedakan agar tidak masuk ke outlet utama.
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

/** Menandai baris impor yang memang diabaikan karena bukan outlet operasional utama. */
function should_skip_import_outlet(value) {
  return /\(\s*ho\s*\)\s*$/i.test(String(value ?? "").trim());
}

/** Memformat bulan dan tahun sebagai label yang mudah dibaca. */
function resolve_month_label(date, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Memformat tanggal lengkap untuk label tampilan. */
function resolve_date_label(date, locale = "id-ID") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Membentuk label periode dari awal bulan hingga tanggal akhir pilihan. */
function resolve_period_label(end_date, locale = "id-ID") {
  return `${new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(end_date)} (1 - ${resolve_date_label(end_date, locale)})`;
}

/** Memisahkan nama bulan dan rentang tanggal ke dua baris untuk header Excel. */
function resolve_export_period_label(label) {
  return String(label ?? "").replace(" (", "\n(");
}

/** Mengambil bagian rentang tanggal beserta tanda kurung dari label periode. */
function resolve_export_period_range(label) {
  const normalized_label = String(label ?? "");
  const separator_index = normalized_label.indexOf(" (");

  return separator_index < 0
    ? normalized_label
    : normalized_label.slice(separator_index + 1);
}

/** Menghitung persentase nilai terhadap pembagi dengan perlindungan pembagi nol. */
function compare_percentage(value, divisor) {
  if (!divisor) {
    return 0;
  }

  return (value / divisor) * 100;
}

/** Mengonversi nilai menjadi angka valid dengan nilai bawaan nol. */
function to_number(value) {
  const parsed_value = Number(value ?? 0);

  return Number.isFinite(parsed_value) ? parsed_value : 0;
}

/** Memvalidasi tanggal metrik berformat YYYY-MM-DD dan mengubahnya menjadi Date UTC. */
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

/** Menghasilkan batas akhir hari untuk tanggal UTC yang diberikan. */
function end_of_day(date) {
  return new Date(date.getTime() + 86_400_000 - 1);
}

/** Key unik untuk memastikan hanya ada satu record aktif per outlet dan tanggal. */
function build_active_daily_key(uuid_outlet, date) {
  return `${uuid_outlet}:${date.toISOString().slice(0, 10)}`;
}

async function clear_daily_served_active_keys(
  transaction,
  {
    uuid_outlet,
    date,
    exclude_uuid,
  },
) {
  await transaction.tbl_dilayani.updateMany({
    where: {
      uuid_outlet,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      date: {
        gte: date,
        lte: end_of_day(date),
      },
      active_key: {
        not: null,
      },
    },
    data: {
      active_key: null,
    },
  });
}

/** Mengubah daftar record menjadi daftar tanggal unik yang tersedia. */
function map_available_dates(rows) {
  return Array.from(
    new Set(
      rows
        .map((item) => item.date ?? item.created_at)
        .filter(Boolean)
        .map((date) => date.toISOString().slice(0, 10)),
    ),
  ).sort((first_date, second_date) => second_date.localeCompare(first_date));
}

// ============================================================================
// Rumus dan agregasi Nilai Transaksi / Basket Size
// ============================================================================

/** Menghitung target, pencapaian, pertumbuhan, dan gap Nilai Transaksi. */
function build_nilai_transaksi_metrics({
  target,
  daily,
  last_month,
  current_month,
}) {
  const nt_has_target = target !== null && target !== undefined;
  const nt_target = nt_has_target ? to_number(target) : null;
  const nt_daily = to_number(daily);
  const nt_last_month = to_number(last_month);
  const nt_current_month = to_number(current_month);
  const nt_growth = compare_percentage(nt_current_month, nt_last_month);
  const nt_gap_growth = nt_growth - 100;
  const nt_target_compare = nt_has_target
    ? compare_percentage(nt_current_month, nt_target)
    : null;
  const nt_gap_target = nt_target_compare === null ? null : nt_target_compare - 100;

  return {
    nt_has_target,
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

/** Membulatkan nilai dasar NS pada baris outlet, tanpa mengubah row rata-rata. */
function round_nilai_transaksi_row_values(row) {
  return {
    ...row,
    nt_daily: Math.round(to_number(row.nt_daily)),
    nt_last_month: Math.round(to_number(row.nt_last_month)),
    nt_current_month: Math.round(to_number(row.nt_current_month)),
  };
}

/** Menghitung target, pencapaian, pertumbuhan, dan gap Basket Size. */
function build_basket_size_metrics({
  target,
  last_month,
  current_month,
}) {
  const bs_has_target = target !== null && target !== undefined;
  const bs_target = bs_has_target ? to_number(target) : null;
  const bs_last_month = to_number(last_month);
  const bs_current_month = to_number(current_month);
  const bs_growth = compare_percentage(bs_current_month, bs_last_month);
  const bs_gap_growth = bs_growth - 100;
  const bs_target_compare = bs_has_target
    ? compare_percentage(bs_current_month, bs_target)
    : null;
  const bs_gap_target = bs_target_compare === null ? null : bs_target_compare - 100;

  return {
    bs_has_target,
    bs_target,
    bs_last_month,
    bs_current_month,
    bs_growth,
    bs_gap_growth,
    bs_target_compare,
    bs_gap_target,
  };
}

/**
 * Membentuk row rata-rata kategori.
 * Target dirata-ratakan per outlet, sedangkan aktual dihitung dari total dasar.
 */
function summarize_metric_rows(rows, target_override = {}) {
  const summary = rows.reduce(
    // rumus all category / per category
    (current, row) => ({
      nt_target: current.nt_target + row.nt_target,
      nt_daily_total_revenue: current.nt_daily_total_revenue + row.nt_daily_total_revenue,
      nt_daily_served: current.nt_daily_served + row.nt_daily_served,
      nt_last_month_total_revenue: current.nt_last_month_total_revenue + row.nt_last_month_total_revenue,
      nt_last_month_served: current.nt_last_month_served + row.nt_last_month_served,
      nt_current_month_total_revenue: current.nt_current_month_total_revenue + row.nt_current_month_total_revenue,
      nt_current_month_served: current.nt_current_month_served + row.nt_current_month_served,
      bs_target: current.bs_target + row.bs_target,
      bs_daily_sku_qty: current.bs_daily_sku_qty + row.bs_daily_sku_qty,
      bs_daily_served: current.bs_daily_served + row.bs_daily_served,
      bs_last_month_sku_qty: current.bs_last_month_sku_qty + row.bs_last_month_sku_qty,
      bs_last_month_served: current.bs_last_month_served + row.bs_last_month_served,
      bs_current_month_sku_qty: current.bs_current_month_sku_qty + row.bs_current_month_sku_qty,
      bs_current_month_served: current.bs_current_month_served + row.bs_current_month_served,
    }),
    {
      nt_target: 0,
      nt_daily_total_revenue: 0,
      nt_daily_served: 0,
      nt_last_month_total_revenue: 0,
      nt_last_month_served: 0,
      nt_current_month_total_revenue: 0,
      nt_current_month_served: 0,
      bs_target: 0,
      bs_daily_sku_qty: 0,
      bs_daily_served: 0,
      bs_last_month_sku_qty: 0,
      bs_last_month_served: 0,
      bs_current_month_sku_qty: 0,
      bs_current_month_served: 0,
    },
  );

  const row_count = rows.length || 1;
  const nt_daily = summary.nt_daily_served ? summary.nt_daily_total_revenue / summary.nt_daily_served : 0;
  const nt_last_month = summary.nt_last_month_served ? summary.nt_last_month_total_revenue / summary.nt_last_month_served : 0;
  const nt_current_month = summary.nt_current_month_served ? summary.nt_current_month_total_revenue / summary.nt_current_month_served : 0;
  const bs_last_month = summary.bs_last_month_served ? summary.bs_last_month_sku_qty / summary.bs_last_month_served : 0;
  const bs_current_month = summary.bs_current_month_served ? summary.bs_current_month_sku_qty / summary.bs_current_month_served : 0;

  return {
    nt_daily_total_revenue: summary.nt_daily_total_revenue,
    nt_daily_served: summary.nt_daily_served,
    nt_last_month_total_revenue: summary.nt_last_month_total_revenue,
    nt_last_month_served: summary.nt_last_month_served,
    nt_current_month_total_revenue: summary.nt_current_month_total_revenue,
    nt_current_month_served: summary.nt_current_month_served,
    bs_daily_sku_qty: summary.bs_daily_sku_qty,
    bs_daily_served: summary.bs_daily_served,
    bs_last_month_sku_qty: summary.bs_last_month_sku_qty,
    bs_last_month_served: summary.bs_last_month_served,
    bs_current_month_sku_qty: summary.bs_current_month_sku_qty,
    bs_current_month_served: summary.bs_current_month_served,
    ...build_nilai_transaksi_metrics({
      target: Object.hasOwn(target_override, "nilai_transaksi")
        ? target_override.nilai_transaksi
        : summary.nt_target / row_count,
      daily: nt_daily,
      last_month: nt_last_month,
      current_month: nt_current_month,
    }),
    ...build_basket_size_metrics({
      target: Object.hasOwn(target_override, "basket_size")
        ? target_override.basket_size
        : summary.bs_target / row_count,
      last_month: bs_last_month,
      current_month: bs_current_month,
    }),
  };
}

// ============================================================================
// Pembacaan file impor dan target aktif
// ============================================================================

/** Membaca laporan outlet melalui parser Python dan memvalidasi hasilnya. */
async function parse_report_workbook(file_path, import_date) {
  const parser_path = path.join(process.cwd(), "src/scripts/parse_outlet_report.py");
  const parser_args = [parser_path, file_path];

  if (import_date) {
    parser_args.push(import_date);
  }

  const { stdout, stderr } = await exec_file("python3", parser_args, {
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

/** Mengambil target aktif terbaru per outlet pada tanggal terpilih. */
async function get_active_target_map({
  model,
  selected_day_start,
  selected_day_end,
  outlet_uuid,
}) {
  const targets = await prisma[model].findMany({
    where: {
      deleted_at: null,
      ...(outlet_uuid ? { uuid_outlet: outlet_uuid } : {}),
      start_date: {
        lte: selected_day_end,
      },
      OR: [
        {
          end_date: null,
        },
        {
          end_date: {
            gte: selected_day_start,
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

/** Mengambil target global NT/BS yang aktif pada tanggal dashboard. */
async function get_global_target_values({
  selected_day_start,
  selected_day_end,
  client = prisma,
} = {}) {
  const rows = await client.tbl_target_global.findMany({
    where: {
      key: {
        in: Object.keys(empty_global_targets),
      },
      deleted_at: null,
      ...(selected_day_start && selected_day_end
        ? {
            start_date: {
              lte: selected_day_end,
            },
            OR: [
              { end_date: null },
              {
                end_date: {
                  gte: selected_day_start,
                },
              },
            ],
          }
        : {}),
    },
    select: {
      key: true,
      value: true,
    },
    orderBy: {
      start_date: "desc",
    },
  });
  const targets = { ...empty_global_targets };
  const resolved_keys = new Set();

  rows.forEach((row) => {
    if (!resolved_keys.has(row.key)) {
      targets[row.key] = to_number(row.value);
      resolved_keys.add(row.key);
    }
  });

  return targets;
}

// ============================================================================
// Query dashboard NS/BS
// ============================================================================

/** Menggabungkan data outlet, aktual NS/BS, dan target menjadi baris metrik. */
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
    const current_nilai_transaksi_data = current_nilai_transaksi_map.get(outlet.uuid);
    const current_month_nilai_transaksi_data =
      current_month_nilai_transaksi_map.get(outlet.uuid);
    const last_nilai_transaksi_data = last_nilai_transaksi_map.get(outlet.uuid);
    const current_basket_size_data = current_basket_size_map.get(outlet.uuid);
    const current_month_basket_size_data = current_month_basket_size_map.get(outlet.uuid);
    const last_basket_size_data = last_basket_size_map.get(outlet.uuid);
    const current_nilai_transaksi = current_nilai_transaksi_data?.calculated_value ?? 0;
    const current_month_nilai_transaksi =
      current_month_nilai_transaksi_data?.calculated_value ?? 0;
    const last_nilai_transaksi = last_nilai_transaksi_data?.calculated_value ?? 0;
    const current_basket_size = current_basket_size_data?.calculated_value ?? 0;
    const current_month_basket_size =
      current_month_basket_size_data?.calculated_value ?? 0;
    const last_basket_size = last_basket_size_data?.calculated_value ?? 0;
    const nilai_transaksi_target = nilai_transaksi_target_map.get(outlet.uuid) ?? 0;
    const basket_size_target = basket_size_target_map.get(outlet.uuid) ?? 0;

    return {
      uuid: outlet.uuid,
      outlet_name: outlet.name,
      kategori: outlet.category,
      total_revenue: current_nilai_transaksi_data?.total_revenue ?? 0,
      served: current_nilai_transaksi_data?.served ?? 0,
      nt_daily_total_revenue: current_nilai_transaksi_data?.total_revenue ?? 0,
      nt_daily_served: current_nilai_transaksi_data?.served ?? 0,
      nt_last_month_total_revenue: last_nilai_transaksi_data?.total_revenue ?? 0,
      nt_last_month_served: last_nilai_transaksi_data?.served ?? 0,
      nt_current_month_total_revenue:
        current_month_nilai_transaksi_data?.total_revenue ?? 0,
      nt_current_month_served: current_month_nilai_transaksi_data?.served ?? 0,
      bs_daily_sku_qty: current_basket_size_data?.sku_qty ?? 0,
      bs_daily_served: current_basket_size_data?.served ?? 0,
      bs_last_month_sku_qty: last_basket_size_data?.sku_qty ?? 0,
      bs_last_month_served: last_basket_size_data?.served ?? 0,
      bs_current_month_sku_qty: current_month_basket_size_data?.sku_qty ?? 0,
      bs_current_month_served: current_month_basket_size_data?.served ?? 0,
      category_key: String(outlet.category ?? "")
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
        target: basket_size_target,
        last_month: last_basket_size,
        current_month: current_month_basket_size,
      }),
    };
  });
}

/** Mengambil outlet aktif yang memang memiliki data NT pada periode terpilih. */
function filter_outlets_by_nilai_transaksi_period(outlets, nilai_transaksi_rows) {
  const nilai_transaksi_outlet_uuids = new Set(
    nilai_transaksi_rows
      .map((item) => String(item.uuid_outlet ?? "").trim())
      .filter(Boolean),
  );

  return outlets.filter((outlet) => nilai_transaksi_outlet_uuids.has(outlet.uuid));
}

/** Menjumlahkan data kunjungan dari tabel dilayani per outlet. */
function build_visit_map(rows) {
  const visits_by_outlet = new Map();

  rows.forEach((item) => {
    if (!item.uuid_outlet) {
      return;
    }

    visits_by_outlet.set(
      item.uuid_outlet,
      (visits_by_outlet.get(item.uuid_outlet) ?? 0) + to_number(item.value),
    );
  });

  return visits_by_outlet;
}

/** Menghitung Nilai Transaksi dari total pendapatan dibagi served count per outlet. */
function build_nilai_transaksi_map(rows, visit_rows = []) {
  const totals_by_outlet = new Map();
  const visits_by_outlet = build_visit_map(visit_rows);

  rows.forEach((item) => {
    const uuid_outlet = item.uuid_outlet;

    if (!uuid_outlet) {
      return;
    }

    const current = totals_by_outlet.get(uuid_outlet) ?? {
      total_revenue: 0,
      served: visits_by_outlet.get(uuid_outlet) ?? 0,
    };

    current.total_revenue += to_number(item.total_revenue);
    totals_by_outlet.set(uuid_outlet, current);
  });

  return new Map(
    Array.from(totals_by_outlet, ([uuid_outlet, totals]) => [
      uuid_outlet,
      {
        ...totals,
        calculated_value: totals.served ? totals.total_revenue / totals.served : 0,
      },
    ]),
  );
}

/** Menghitung Basket Size dari jumlah SKU dibagi served count per outlet. */
function build_basket_size_map(rows, visit_rows = []) {
  const totals_by_outlet = new Map();
  const visits_by_outlet = build_visit_map(visit_rows);

  rows.forEach((item) => {
    const uuid_outlet = item.uuid_outlet;

    if (!uuid_outlet) {
      return;
    }

    const current = totals_by_outlet.get(uuid_outlet) ?? {
      sku_qty: 0,
      served: visits_by_outlet.get(uuid_outlet) ?? 0,
    };

    current.sku_qty += to_number(item.sku_qty);
    totals_by_outlet.set(uuid_outlet, current);
  });

  return new Map(
    Array.from(totals_by_outlet, ([uuid_outlet, totals]) => [
      uuid_outlet,
      {
        ...totals,
        calculated_value: totals.served ? totals.sku_qty / totals.served : 0,
      },
    ]),
  );
}

/** Mengambil dashboard gabungan NS/BS beserta target, ringkasan kategori, dan tanggal tersedia. */
export async function getNilaiTransaksiBasketSize({
  selected_date,
  member_outlet_uuid,
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
  const outlet_scope = member_outlet_uuid
    ? { uuid_outlet: member_outlet_uuid }
    : {};

  const [
    outlets,
    current_nilai_transaksi,
    current_month_nilai_transaksi,
    last_nilai_transaksi,
    current_basket_size,
    current_month_basket_size,
    last_basket_size,
    current_served,
    current_month_served,
    last_served,
    nilai_transaksi_target_map,
    basket_size_target_map,
    nilai_transaksi_dates,
    basket_size_dates,
    global_targets,
  ] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: {
        deleted_at: null,
        excep: false,
        ...(member_outlet_uuid ? { uuid: member_outlet_uuid } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uuid: true,
        name: true,
        category: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_day_start,
          lte: current_day_end,
        },
      },
      select: {
        uuid_outlet: true,
        total_revenue: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_month_start,
          lte: current_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        total_revenue: true,
      },
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: previous_month_start,
          lte: previous_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        total_revenue: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_day_start,
          lte: current_day_end,
        },
      },
      select: {
        uuid_outlet: true,
        sku_qty: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_month_start,
          lte: current_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        sku_qty: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: previous_month_start,
          lte: previous_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        sku_qty: true,
      },
    }),
    prisma.tbl_dilayani.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_day_start,
          lte: current_day_end,
        },
      },
      select: {
        uuid_outlet: true,
        value: true,
      },
    }),
    prisma.tbl_dilayani.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: current_month_start,
          lte: current_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        value: true,
      },
    }),
    prisma.tbl_dilayani.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
        date: {
          gte: previous_month_start,
          lte: previous_month_end,
        },
      },
      select: {
        uuid_outlet: true,
        value: true,
      },
    }),
    get_active_target_map({
      model: "tbl_target_nilai_transaksi",
      selected_day_start: current_day_start,
      selected_day_end: current_day_end,
      outlet_uuid: member_outlet_uuid,
    }),
    get_active_target_map({
      model: "tbl_target_basket_size",
      selected_day_start: current_day_start,
      selected_day_end: current_day_end,
      outlet_uuid: member_outlet_uuid,
    }),
    prisma.tbl_nilai_transaksi.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
      },
      select: {
        date: true,
      },
    }),
    prisma.tbl_basket_size.findMany({
      where: {
        deleted_at: null,
        ...outlet_scope,
      },
      select: {
        date: true,
      },
    }),
    get_global_target_values({
      selected_day_start: current_day_start,
      selected_day_end: current_day_end,
    }),
  ]);

  const current_nilai_transaksi_map = build_nilai_transaksi_map(current_nilai_transaksi, current_served);
  const current_month_nilai_transaksi_map = build_nilai_transaksi_map(current_month_nilai_transaksi, current_month_served);
  const last_nilai_transaksi_map = build_nilai_transaksi_map(last_nilai_transaksi, last_served);
  const current_basket_size_map = build_basket_size_map(current_basket_size, current_served);
  const current_month_basket_size_map = build_basket_size_map(current_month_basket_size, current_month_served);
  const last_basket_size_map = build_basket_size_map(last_basket_size, last_served);
  const metric_outlets = filter_outlets_by_nilai_transaksi_period(
    outlets,
    current_month_nilai_transaksi,
  );

  const rows = map_metric_rows({
    outlets: metric_outlets,
    current_nilai_transaksi_map,
    current_month_nilai_transaksi_map,
    last_nilai_transaksi_map,
    current_basket_size_map,
    current_month_basket_size_map,
    last_basket_size_map,
    nilai_transaksi_target_map,
    basket_size_target_map,
  });

  // Ringkasan per kategori.
  const category_metrics = Object.fromEntries(
    outlet_category_slugs.map((category) => [
      category,
      summarize_metric_rows(
        rows.filter((row) => row.category_key === category),
      ),
    ]),
  );

  const overall_metrics = summarize_metric_rows(rows, global_targets);

  const rounded_rows = rows.map(round_nilai_transaksi_row_values);

  return {
    selected_month_label: resolve_month_label(current_date),
    previous_month_label: resolve_month_label(previous_month_start),
    selected_date_label: resolve_date_label(current_date),
    selected_period_label: resolve_period_label(current_date),
    previous_period_label: resolve_period_label(previous_month_end),
    rows: rounded_rows,
    category_metrics,
    overall_metrics,
    global_targets,
    available_dates: {
      nilai_transaksi: map_available_dates(nilai_transaksi_dates),
      basket_size: map_available_dates(basket_size_dates),
    },
  };
}


// ============================================================================
// Export Excel laporan NS/BS
// ============================================================================

const export_font_name = "Aptos";

function set_export_formula(cell, formula, result) {
  cell.value = {
    formula,
    result: to_number(result),
  };
}

function apply_export_gap_fill(cell, value) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: value >= 0 ? "FFC6E0B4" : "FFF4A09C",
    },
  };
}

function write_export_metric_formulas(row, metrics) {
  const row_number = row.number;

  set_export_formula(
    row.getCell("H"),
    `IF(F${row_number}=0,0,G${row_number}/F${row_number}*100)`,
    metrics.nt_growth,
  );
  set_export_formula(
    row.getCell("I"),
    `H${row_number}-100`,
    metrics.nt_gap_growth,
  );
  set_export_formula(
    row.getCell("J"),
    `IF(D${row_number}=0,0,G${row_number}/D${row_number}*100)`,
    metrics.nt_target_compare,
  );
  set_export_formula(
    row.getCell("K"),
    `J${row_number}-100`,
    metrics.nt_gap_target,
  );
  set_export_formula(
    row.getCell("O"),
    `IF(M${row_number}=0,0,N${row_number}/M${row_number}*100)`,
    metrics.bs_growth,
  );
  set_export_formula(
    row.getCell("P"),
    `O${row_number}-100`,
    metrics.bs_gap_growth,
  );
  set_export_formula(
    row.getCell("Q"),
    `IF(L${row_number}=0,0,N${row_number}/L${row_number}*100)`,
    metrics.bs_target_compare,
  );
  set_export_formula(
    row.getCell("R"),
    `Q${row_number}-100`,
    metrics.bs_gap_target,
  );

  ["I", "K", "P", "R"].forEach((column) => {
    apply_export_gap_fill(row.getCell(column), to_number(row.getCell(column).result));
  });
}

function add_export_data_row(
  sheet,
  item,
  number,
  category_label,
  is_highest_daily = false,
) {
  const row = sheet.addRow([
    number,
    item.outlet_name,
    category_label,
    item.nt_target,
    item.nt_daily,
    item.nt_last_month,
    item.nt_current_month,
    null,
    null,
    null,
    null,
    item.bs_target,
    item.bs_last_month,
    item.bs_current_month,
    null,
    null,
    null,
    null,
  ]);

  write_export_metric_formulas(row, item);

  if (is_highest_daily) {
    row.getCell("E").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6E0B4" },
    };
  }

  return row;
}

function add_export_average_row({
  sheet,
  category_label,
  metrics,
  start_row,
  end_row,
}) {
  const row = sheet.addRow([
    `RATA-RATA NILAI TRANSAKSI OUTLET ${category_label.toUpperCase()}`,
  ]);
  const row_number = row.number;

  sheet.mergeCells(`A${row_number}:C${row_number}`);
  ["D", "L"].forEach((column) => {
    const metric_key = {
      D: "nt_target",
      L: "bs_target",
    }[column];

    set_export_formula(
      row.getCell(column),
      `AVERAGE(${column}${start_row}:${column}${end_row})`,
      metrics[metric_key],
    );
  });

  ["E", "F", "G", "M", "N"].forEach((column) => {
    const metric_key = {
      E: "nt_daily",
      F: "nt_last_month",
      G: "nt_current_month",
      M: "bs_last_month",
      N: "bs_current_month",
    }[column];

    row.getCell(column).value = metrics[metric_key];
  });

  write_export_metric_formulas(row, metrics);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };
    cell.font = { name: export_font_name, bold: true, size: 11 };
  });

  return row_number;
}

function add_export_total_row(sheet, metrics) {
  const row = sheet.addRow(["TOTAL NILAI TRANSAKSI & BASKET SIZE APOTEKKU"]);
  const row_number = row.number;

  sheet.mergeCells(`A${row_number}:C${row_number}`);
  row.getCell("D").value = metrics.nt_target;
  row.getCell("L").value = metrics.bs_target;

  ["E", "F", "G", "M", "N"].forEach((column) => {
    const metric_key = {
      E: "nt_daily",
      F: "nt_last_month",
      G: "nt_current_month",
      M: "bs_last_month",
      N: "bs_current_month",
    }[column];

    row.getCell(column).value = metrics[metric_key];
  });
  write_export_metric_formulas(row, metrics);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };
    cell.font = { name: export_font_name, bold: true, size: 11 };
  });

  ["I", "K", "P", "R"].forEach((column) => {
    apply_export_gap_fill(row.getCell(column), metrics[{
      I: "nt_gap_growth",
      K: "nt_gap_target",
      P: "bs_gap_growth",
      R: "bs_gap_target",
    }[column]]);
  });
}

/** Membuat workbook gabungan NS/BS mengikuti format sheet Share bulanan. */
export async function exportNilaiTransaksiBasketSizeWorkbook({
  selected_date,
  member_outlet_uuid,
}) {
  const data = await getNilaiTransaksiBasketSize({
    selected_date,
    member_outlet_uuid,
  });
  const workbook = new ExcelJS.Workbook();
  const sheet_name = `Share ${data.selected_month_label}`.slice(0, 31);
  const sheet = workbook.addWorksheet(sheet_name, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.3,
        bottom: 0.3,
        header: 0.1,
        footer: 0.1,
      },
    },
  });

  workbook.creator = "Performance Report";
  workbook.created = new Date();
  const outlet_column_width = data.rows.reduce(
    (maximum_width, row) => Math.max(
      maximum_width,
      String(row.outlet_name ?? "").length + 2,
    ),
    22,
  );
  sheet.columns = export_columns.map((column) => (
    column.key === "outlet"
      ? { ...column, width: Math.min(40, outlet_column_width) }
      : column
  ));
  sheet.mergeCells("A1:R1");
  sheet.getCell("A1").value =
    `PEMANTAUAN NILAI TRANSAKSI DAN BASKET SIZE APOTEKKU ${data.selected_month_label.toUpperCase()}`;
  sheet.getCell("A1").font = {
    name: export_font_name,
    bold: true,
    size: 20,
  };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 38;

  ["A", "B", "C"].forEach((column) => sheet.mergeCells(`${column}2:${column}4`));
  sheet.mergeCells("D2:K2");
  sheet.mergeCells("L2:R2");
  ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"]
    .forEach((column) => sheet.mergeCells(`${column}3:${column}4`));

  sheet.getCell("A2").value = "No";
  sheet.getCell("B2").value = "Outlet";
  sheet.getCell("C2").value = "Jenis";
  sheet.getCell("D2").value = "NILAI TRANSAKSI";
  sheet.getCell("L2").value = "BASKET SIZE";
  sheet.getCell("D3").value = "Target";
  sheet.getCell("E3").value = `Harian\n(${data.selected_date_label})`;
  sheet.getCell("F3").value = resolve_export_period_label(data.previous_period_label);
  sheet.getCell("G3").value = resolve_export_period_label(data.selected_period_label);
  sheet.getCell("H3").value = `% GROWTH\n(DIBANDING ${data.previous_month_label.toUpperCase()})`;
  sheet.getCell("I3").value = "GAP GROWTH";
  sheet.getCell("J3").value = "% DIBANDING TARGET";
  sheet.getCell("K3").value = "GAP TARGET";
  sheet.getCell("L3").value = "TARGET";
  sheet.getCell("M3").value = resolve_export_period_label(data.previous_period_label);
  sheet.getCell("N3").value = `CAPAIAN\n${resolve_export_period_range(data.selected_period_label)}`;
  sheet.getCell("O3").value = `% GROWTH\n(DIBANDING ${data.previous_month_label.toUpperCase()})`;
  sheet.getCell("P3").value = "GAP GROWTH";
  sheet.getCell("Q3").value = "% DIBANDING TARGET";
  sheet.getCell("R3").value = "GAP TARGET";

  for (let row_number = 2; row_number <= 4; row_number += 1) {
    for (let column_number = 1; column_number <= 18; column_number += 1) {
      const cell = sheet.getCell(row_number, column_number);
      cell.font = { name: export_font_name, bold: true, size: 11 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }
  }
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 32;
  sheet.getRow(4).height = 8;

  const average_rows = [];

  outlet_category_slugs.forEach((category_key) => {
    const category_rows = data.rows
      .filter((row) => row.category_key === category_key)
      .sort((first, second) =>
        second.nt_gap_growth - first.nt_gap_growth ||
        first.outlet_name.localeCompare(second.outlet_name, "id-ID"),
      );

    if (!category_rows.length) {
      return;
    }

    const category_label = export_category_labels[category_key] ?? category_key;
    const start_row = sheet.rowCount + 1;
    const highest_daily = Math.max(
      ...category_rows.map((row) => to_number(row.nt_daily)),
    );

    category_rows.forEach((row, index) => {
      add_export_data_row(
        sheet,
        row,
        index + 1,
        category_label,
        to_number(row.nt_daily) === highest_daily,
      );
    });

    average_rows.push(add_export_average_row({
      sheet,
      category_label,
      metrics: data.category_metrics[category_key],
      start_row,
      end_row: sheet.rowCount,
    }));
  });

  if (average_rows.length) {
    add_export_total_row(sheet, data.overall_metrics);
  }

  for (let row_number = 1; row_number <= sheet.rowCount; row_number += 1) {
    for (let column_number = 1; column_number <= 18; column_number += 1) {
      const cell = sheet.getCell(row_number, column_number);
      cell.border = {
        top: { style: "thin", color: { argb: "FF595959" } },
        left: { style: "thin", color: { argb: "FF595959" } },
        bottom: { style: "thin", color: { argb: "FF595959" } },
        right: { style: "thin", color: { argb: "FF595959" } },
      };

      if (row_number >= 5) {
        cell.alignment = {
          vertical: "middle",
          horizontal: column_number === 2 ? "left" : "center",
          wrapText: column_number === 3,
          shrinkToFit: column_number === 2,
        };
        cell.font = { ...cell.font, name: export_font_name, size: 11 };
      }
    }
  }

  sheet.getColumn("D").numFmt = '"Rp"* #,##0';
  sheet.getColumn("E").numFmt = '"Rp"* #,##0';
  sheet.getColumn("F").numFmt = '"Rp"* #,##0';
  sheet.getColumn("G").numFmt = '"Rp"* #,##0';
  ["H", "I", "J", "K", "O", "P", "Q", "R"]
    .forEach((column) => {
      sheet.getColumn(column).numFmt = '0.00"%"';
    });
  ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"]
    .forEach((column) => {
      if (!["H", "I", "J", "K", "O", "P", "Q", "R"].includes(column)) {
        sheet.getColumn(column).numFmt = "0.00";
      }
    });
  sheet.pageSetup.printArea = `A1:R${sheet.rowCount}`;

  const buffer = await workbook.xlsx.writeBuffer();
  const file_month = data.selected_month_label
    .toUpperCase()
    .replace(/\s+/g, "-");

  return {
    buffer,
    filename: `NILAI-TRANSAKSI-DAN-BASKET-SIZE-${file_month}.xlsx`,
  };
}


// ============================================================================
// Mutasi data harian NS/BS
// ============================================================================

/** Memastikan UUID outlet merujuk pada outlet yang masih aktif. */
async function assert_active_outlet(uuid_outlet) {
  const normalized_uuid_outlet = String(uuid_outlet ?? "").trim();

  if (!normalized_uuid_outlet) {
    throw new Error("Outlet wajib dipilih.");
  }

  const outlet = await prisma.tbl_outlet.findFirst({
    where: {
      uuid: normalized_uuid_outlet,
      deleted_at: null,
      excep: false,
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

/** Memperbarui nilai transaksi harian outlet dan membersihkan record duplikat pada hari yang sama. */
export async function updateNilaiTransaksiDaily({
  uuid_outlet,
  selected_date,
  total_revenue,
}) {
  const normalized_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const date = parse_metric_date(selected_date, "Tanggal data");
  const normalized_total_revenue = String(total_revenue ?? "")
    .trim()
    .replace(",", ".");
  const parsed_total_revenue = Number(normalized_total_revenue);

  if (
    !normalized_total_revenue ||
    !Number.isFinite(parsed_total_revenue) ||
    parsed_total_revenue < 0 ||
    Math.abs(parsed_total_revenue * 100 - Math.round(parsed_total_revenue * 100)) > 1e-9
  ) {
    throw new Error(
      "Total penerimaan pendapatan harus berupa angka nol atau lebih dengan maksimal 2 desimal.",
    );
  }

  return prisma.$transaction(async (transaction) => {
    const records = await transaction.tbl_nilai_transaksi.findMany({
      where: {
        uuid_outlet: normalized_uuid_outlet,
        deleted_at: null,
        date: {
          gte: date,
          lte: end_of_day(date),
        },
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
        active_key: build_active_daily_key(normalized_uuid_outlet, date),
        total_revenue: parsed_total_revenue,
      },
    });

    if (records.length > 1) {
      await transaction.tbl_nilai_transaksi.updateMany({
        where: {
          uuid: {
            in: records.slice(1).map((item) => item.uuid),
          },
          deleted_at: null,
        },
        data: {
          active_key: null,
          deleted_at: new Date(),
        },
      });
    }

    return {
      success: true,
      message: "Data pembentuk nilai transaksi harian berhasil diperbarui.",
    };
  });
}

/** Menghapus seluruh record harian sebuah metrik untuk satu outlet. */
async function delete_metric_daily({
  model,
  metric_label,
  uuid_outlet,
  selected_date,
}) {
  const normalized_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const date = parse_metric_date(selected_date, "Tanggal data");
  const result = await prisma[model].updateMany({
    where: {
      uuid_outlet: normalized_uuid_outlet,
      deleted_at: null,
      date: {
        gte: date,
        lte: end_of_day(date),
      },
    },
    data: {
      active_key: null,
      deleted_at: new Date(),
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

/** Menghapus seluruh record sebuah metrik pada tanggal tertentu. */
async function bulk_delete_metric_date({
  model,
  metric_label,
  selected_date,
}) {
  const date = parse_metric_date(selected_date, "Tanggal data");
  const result = await prisma[model].updateMany({
    where: {
      deleted_at: null,
      date: {
        gte: date,
        lte: end_of_day(date),
      },
    },
    data: {
      active_key: null,
      deleted_at: new Date(),
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

/** Memindahkan tanggal seluruh data Nilai Transaksi dari satu hari ke hari lain. */
async function bulk_update_metric_date({
  model,
  metric_label,
  source_date,
  target_date,
}) {
  const parsed_source_date = parse_metric_date(source_date, "Tanggal lama");
  const parsed_target_date = parse_metric_date(target_date, "Tanggal baru");

  if (parsed_source_date.getTime() === parsed_target_date.getTime()) {
    throw new Error("Tanggal baru harus berbeda dari tanggal lama.");
  }

  return prisma.$transaction(async (transaction) => {
    const source_records = await transaction[model].findMany({
      where: {
        deleted_at: null,
        date: {
          gte: parsed_source_date,
          lte: end_of_day(parsed_source_date),
        },
      },
      select: {
        uuid: true,
        uuid_outlet: true,
      },
    });

    if (!source_records.length) {
      throw new Error(`Data ${metric_label} pada tanggal lama tidak ditemukan.`);
    }

    const target_record = await transaction[model].findFirst({
      where: {
        deleted_at: null,
        date: {
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
        `Edit massal dibatalkan karena tanggal baru sudah memiliki data ${metric_label}.`,
      );
    }

    for (const record of source_records) {
      await transaction[model].update({
        where: {
          uuid: record.uuid,
        },
        data: {
          date: parsed_target_date,
          active_key: build_active_daily_key(record.uuid_outlet, parsed_target_date),
        },
      });
    }

    return {
      success: true,
      message: `Tanggal ${metric_label} berhasil diperbarui untuk ${source_records.length} outlet.`,
      data: {
        updated_count: source_records.length,
        target_date: parsed_target_date.toISOString().slice(0, 10),
      },
    };
  });
}

/** Memindahkan tanggal seluruh data Nilai Transaksi dari satu hari ke hari lain. */
export function bulkUpdateNilaiTransaksiDate(payload) {
  return bulk_update_metric_date({
    ...payload,
    model: "tbl_nilai_transaksi",
    metric_label: "nilai transaksi",
  });
}

/** Memindahkan tanggal seluruh data Basket Size dari satu hari ke hari lain. */
export function bulkUpdateBasketSizeDate(payload) {
  return bulk_update_metric_date({
    ...payload,
    model: "tbl_basket_size",
    metric_label: "basket size",
  });
}

/** Menghapus data Nilai Transaksi harian untuk satu outlet. */
export function deleteNilaiTransaksiDaily(payload) {
  return delete_metric_daily({
    ...payload,
    model: "tbl_nilai_transaksi",
    metric_label: "Nilai transaksi",
  });
}

/** Menghapus seluruh data Nilai Transaksi pada tanggal terpilih. */
export function bulkDeleteNilaiTransaksiDate(payload) {
  return bulk_delete_metric_date({
    ...payload,
    model: "tbl_nilai_transaksi",
    metric_label: "nilai transaksi",
  });
}

/** Menghapus data Basket Size harian untuk satu outlet. */
export function deleteBasketSizeDaily(payload) {
  return delete_metric_daily({
    ...payload,
    model: "tbl_basket_size",
    metric_label: "Basket size",
  });
}

/** Menghapus seluruh data Basket Size pada tanggal terpilih. */
export function bulkDeleteBasketSizeDate(payload) {
  return bulk_delete_metric_date({
    ...payload,
    model: "tbl_basket_size",
    metric_label: "basket size",
  });
}


// ============================================================================
// Import data harian NS/BS
// ============================================================================

/** Mengimpor satu jenis metrik outlet dan mengganti data pada setiap tanggal laporan. */
async function importOutletReportMetric({
  file_path,
  import_date,
  model,
  metric_label,
  build_record,
  validate_row,
  resolve_served,
  use_existing_served = false,
  use_file_dates = false,
  member_outlet_uuid,
}) {
  const normalized_import_date = String(import_date ?? "").trim();
  const selected_report_date = use_file_dates
    ? null
    : parse_metric_date(normalized_import_date, "Tanggal impor");
  const payload = await parse_report_workbook(
    file_path,
    use_file_dates ? undefined : normalized_import_date,
  );
  const outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      excep: false,
      ...(member_outlet_uuid ? { uuid: member_outlet_uuid } : {}),
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
  const unmatched_outlets = new Set();

  payload.rows.forEach((row) => {
    if (should_skip_import_outlet(row.outlet_name)) {
      return;
    }

    const matched_outlet = outlet_map.get(normalize_outlet_name(row.outlet_name));

    if (!matched_outlet) {
      unmatched_outlets.add(row.outlet_name);
      return;
    }

    const total_penerimaan_pendapatan = to_number(row.total_penerimaan_pendapatan);
    const served = use_existing_served ? 0 : to_number(resolve_served(row));
    const sku_qty = to_number(row.sku_qty);
    const row_date_value = use_file_dates ? row.date : normalized_import_date;
    let report_date;

    try {
      report_date = use_file_dates
        ? parse_metric_date(row_date_value, "Tanggal Penjualan pada file Excel")
        : selected_report_date;
    } catch {
      return;
    }

    if (!use_existing_served && (!Number.isInteger(served) || served <= 0)) {
      return;
    }

    const imported_row = {
      uuid_outlet: matched_outlet.uuid,
      outlet_name: matched_outlet.name,
      total_revenue: total_penerimaan_pendapatan,
      served,
      sku_qty,
      report_date,
      report_date_key: report_date.toISOString().slice(0, 10),
    };

    if (!validate_row(imported_row)) {
      return;
    }

    imported_rows.push(imported_row);
  });

  if (!imported_rows.length) {
    throw new Error("Tidak ada data outlet yang cocok untuk diimpor.");
  }

  const aggregated_rows = Array.from(
    imported_rows.reduce((rows_by_outlet_and_date, row) => {
      const aggregate_key = `${row.uuid_outlet}:${row.report_date_key}`;
      const current_row = rows_by_outlet_and_date.get(aggregate_key) ?? {
        ...row,
        total_revenue: 0,
        served: 0,
        sku_qty: 0,
      };

      current_row.total_revenue += row.total_revenue;
      current_row.served += row.served;
      current_row.sku_qty += row.sku_qty;
      rows_by_outlet_and_date.set(aggregate_key, current_row);

      return rows_by_outlet_and_date;
    }, new Map()).values(),
  );
  const imported_dates = Array.from(
    new Set(aggregated_rows.map((row) => row.report_date_key)),
  ).sort();
  const imported_outlet_count = new Set(
    aggregated_rows.map((row) => row.uuid_outlet),
  ).size;
  const imported_outlet_uuids = Array.from(
    new Set(aggregated_rows.map((row) => row.uuid_outlet)),
  );

  await prisma.$transaction(async (tx) => {
    if (use_existing_served && use_file_dates) {
      const first_import_date = parse_metric_date(imported_dates[0]);
      const last_import_date = parse_metric_date(imported_dates.at(-1));
      const visit_rows = await tx.tbl_dilayani.findMany({
        where: {
          deleted_at: null,
          uuid_outlet: {
            in: imported_outlet_uuids,
          },
          date: {
            gte: first_import_date,
            lte: end_of_day(last_import_date),
          },
        },
        select: {
          uuid_outlet: true,
          date: true,
        },
      });
      const visit_keys = new Set(
        visit_rows.map((row) => build_active_daily_key(row.uuid_outlet, row.date)),
      );
      const missing_visit_row = aggregated_rows.find(
        (row) => !visit_keys.has(build_active_daily_key(row.uuid_outlet, row.report_date)),
      );

      if (missing_visit_row) {
        throw new Error(
          `Impor dibatalkan karena data kunjungan outlet ${missing_visit_row.outlet_name} pada tanggal ${missing_visit_row.report_date_key} belum tersedia.`,
        );
      }
    }

    for (const imported_date of imported_dates) {
      const date = parse_metric_date(imported_date);

      await tx[model].updateMany({
        where: {
          deleted_at: null,
          uuid_outlet: {
            in: imported_outlet_uuids,
          },
          date: {
            gte: date,
            lte: end_of_day(date),
          },
        },
        data: {
          active_key: null,
          deleted_at: new Date(),
        },
      });
    }

    if (use_existing_served && use_file_dates) {
      await tx[model].createMany({
        data: aggregated_rows.map((row) => ({
          uuid: randomUUID(),
          uuid_outlet: row.uuid_outlet,
          active_key: build_active_daily_key(row.uuid_outlet, row.report_date),
          date: row.report_date,
          ...build_record(row),
        })),
      });
      return;
    }

    for (const row of aggregated_rows) {
      const report_date = row.report_date;
      const report_day_end = end_of_day(report_date);
      let served_record = await tx.tbl_dilayani.findFirst({
        where: {
          uuid_outlet: row.uuid_outlet,
          date: {
            gte: report_date,
            lte: report_day_end,
          },
        },
        orderBy: {
          updated_at: "desc",
        },
        select: {
          uuid: true,
          value: true,
          deleted_at: true,
        },
      });

      if (use_existing_served && (!served_record || served_record.deleted_at)) {
        throw new Error(
          `Impor dibatalkan karena data kunjungan outlet ${row.outlet_name} pada tanggal ${row.report_date_key} belum tersedia.`,
        );
      }

      if (!use_existing_served) {
        await clear_daily_served_active_keys(tx, {
          uuid_outlet: row.uuid_outlet,
          date: report_date,
          exclude_uuid: served_record?.uuid,
        });

        served_record = served_record
          ? await tx.tbl_dilayani.update({
              where: {
                uuid: served_record.uuid,
              },
              data: {
                value: row.served,
                active_key: build_active_daily_key(row.uuid_outlet, report_date),
                deleted_at: null,
              },
              select: {
                uuid: true,
                value: true,
                deleted_at: true,
              },
            })
          : await tx.tbl_dilayani.create({
              data: {
                uuid: randomUUID(),
                uuid_outlet: row.uuid_outlet,
                active_key: build_active_daily_key(row.uuid_outlet, report_date),
                value: row.served,
                date: report_date,
              },
              select: {
                uuid: true,
                value: true,
                deleted_at: true,
              },
            });
      }

      if (served_record) {
        await tx.tbl_dilayani.updateMany({
          where: {
            uuid_outlet: row.uuid_outlet,
            uuid: {
              not: served_record.uuid,
            },
            deleted_at: null,
            date: {
              gte: report_date,
              lte: report_day_end,
            },
          },
          data: {
            active_key: null,
            deleted_at: new Date(),
          },
        });
      }

      if (!served_record) {
        throw new Error("Data kunjungan tidak ditemukan.");
      }

      const existing_metric = await tx[model].findFirst({
        where: {
          uuid_outlet: row.uuid_outlet,
          date: {
            gte: report_date,
            lte: report_day_end,
          },
        },
        orderBy: {
          updated_at: "desc",
        },
        select: {
          uuid: true,
        },
      });

      if (existing_metric) {
        await tx[model].update({
          where: {
            uuid: existing_metric.uuid,
          },
          data: {
            ...build_record(row),
            active_key: build_active_daily_key(row.uuid_outlet, report_date),
            deleted_at: null,
          },
        });
        await tx[model].updateMany({
          where: {
            uuid_outlet: row.uuid_outlet,
            uuid: {
              not: existing_metric.uuid,
            },
            deleted_at: null,
            date: {
              gte: report_date,
              lte: report_day_end,
            },
          },
          data: {
            active_key: null,
            deleted_at: new Date(),
          },
        });
      } else {
        await tx[model].create({
          data: {
            uuid: randomUUID(),
            uuid_outlet: row.uuid_outlet,
            active_key: build_active_daily_key(row.uuid_outlet, report_date),
            date: report_date,
            ...build_record(row),
          },
        });
      }
    }
  }, {
    maxWait: 10_000,
    timeout: 120_000,
  });

  return {
    success: true,
    message: use_file_dates
      ? `Impor ${metric_label} berhasil untuk ${imported_outlet_count} outlet pada ${imported_dates.length} tanggal.`
      : `Impor ${metric_label} berhasil untuk ${aggregated_rows.length} outlet.`,
    data: {
      imported_count: aggregated_rows.length,
      imported_outlet_count,
      imported_dates,
      unmatched_outlets: Array.from(unmatched_outlets),
      import_date: imported_dates.at(-1) ?? normalized_import_date,
    },
  };
}

/** Mengimpor data Nilai Transaksi dari laporan outlet. */
export function importNilaiTransaksi({
  file_path,
  import_date,
  member_outlet_uuid,
}) {
  return importOutletReportMetric({
    file_path,
    import_date,
    member_outlet_uuid,
    model: "tbl_nilai_transaksi",
    metric_label: "nilai transaksi",
    resolve_served: (row) => row.served_nilai_transaksi ?? row.served,
    validate_row: (row) => row.total_revenue > 0,
    build_record: (row) => ({
      total_revenue: row.total_revenue,
    }),
  });
}

/** Mengimpor data Basket Size dari laporan outlet. */
export function importBasketSize({
  file_path,
  member_outlet_uuid,
}) {
  return importOutletReportMetric({
    file_path,
    member_outlet_uuid,
    model: "tbl_basket_size",
    metric_label: "basket size",
    resolve_served: (row) => row.served_basket_size ?? row.served,
    use_existing_served: true,
    use_file_dates: true,
    validate_row: (row) => Number.isInteger(row.sku_qty) && row.sku_qty > 0,
    build_record: (row) => ({
      sku_qty: row.sku_qty,
    }),
  });
}


// ============================================================================
// Helper target NS/BS
// ============================================================================

const invalid_excel_format_message = "Format Excel tidak sesuai yang diharapkan. Pastikan file .xlsx memiliki kolom outlet dan target.";

/** Menormalkan nama outlet untuk pencocokan pada file target. */
function normalize_target_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(ho\)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

/** Memvalidasi tanggal target dan mengubahnya menjadi Date UTC. */
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

/** Memastikan tanggal akhir target tidak mendahului tanggal mulai. */
function assert_valid_range(start_date, end_date) {
  if (end_date < start_date) {
    throw new Error("Tanggal akhir tidak boleh lebih kecil dari tanggal awal.");
  }
}

/** Membaca file target melalui parser Python dan menghasilkan baris target. */
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

/** Mengambil outlet aktif dalam peta berdasarkan UUID dan nama ternormalisasi. */
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


// ============================================================================
// Mutasi massal target NS/BS
// ============================================================================

/** Membentuk filter tanggal akhir untuk mencari periode target sumber. */
function get_source_end_date_filter(source_start_date, source_end_date) {
  if (source_start_date.getTime() === source_end_date.getTime()) {
    return [
      { end_date: source_end_date },
      { end_date: null },
    ];
  }

  return [{ end_date: source_end_date }];
}

/** Memperbarui periode banyak target sekaligus dengan pemeriksaan bentrok antar-outlet. */
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

/** Menghapus banyak target sekaligus berdasarkan periode yang dipilih. */
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


// ============================================================================
// Konfigurasi dan CRUD target NS/BS
// ============================================================================

const target_metric_config = {
  nilai_transaksi: {
    model: "tbl_target_nilai_transaksi",
    label: "Target Nilai Transaksi",
    scale: 1,
    allow_decimal: false,
  },
  basket_size: {
    model: "tbl_target_basket_size",
    label: "Target Basket Size",
    scale: 1,
    allow_decimal: true,
  },
};

/** Mengambil konfigurasi model, label, skala, dan presisi untuk jenis target. */
function get_metric_config(metric_type) {
  const config = target_metric_config[metric_type];

  if (!config) {
    throw new Error("Jenis target tidak dikenali.");
  }

  return config;
}

/** Memvalidasi nilai target dan mengubahnya ke skala penyimpanan database. */
function parse_target_value(target, config) {
  const normalized_target = String(target ?? "").trim().replace(",", ".");

  if (!normalized_target) {
    throw new Error("Nilai target wajib diisi.");
  }

  const parsed_target = Number(normalized_target);

  if (!Number.isFinite(parsed_target) || parsed_target < 0) {
    throw new Error("Nilai target harus berupa angka nol atau lebih.");
  }

  if (!config.allow_decimal && !Number.isInteger(parsed_target)) {
    throw new Error("Nilai target harus berupa angka bulat nol atau lebih.");
  }

  const scaled_target = parsed_target * config.scale;
  const stored_target = Math.round(scaled_target * 100) / 100;

  if (config.allow_decimal && Math.abs(scaled_target - stored_target) > 1e-9) {
    throw new Error("Nilai target maksimal memiliki 2 angka desimal.");
  }

  return stored_target;
}

/** Memformat target global untuk form pengaturan. */
function format_global_target(item) {
  return item
    ? {
        uuid: item.uuid,
        key: item.key,
        target: to_number(item.value),
        start_date: item.start_date.toISOString().slice(0, 10),
        end_date: item.end_date?.toISOString().slice(0, 10) ?? "",
      }
    : null;
}

/** Mencari bentrok periode target global pada jenis yang sama. */
async function find_overlapping_global_target({
  key,
  start_date,
  end_date,
  exclude_uuid,
}) {
  return prisma.tbl_target_global.findFirst({
    where: {
      key,
      deleted_at: null,
      ...(exclude_uuid ? { uuid: { not: exclude_uuid } } : {}),
      start_date: { lte: end_date },
      OR: [
        { end_date: null },
        { end_date: { gte: start_date } },
      ],
    },
    select: { uuid: true },
  });
}

/** Mengambil daftar rentang target global untuk satu jenis metrik. */
export async function getTargetGlobal({ key } = {}) {
  const metric_key = key || "nilai_transaksi";

  get_metric_config(metric_key);
  const rows = await prisma.tbl_target_global.findMany({
    where: { key: metric_key, deleted_at: null },
    orderBy: [
      { start_date: "desc" },
      { created_at: "desc" },
    ],
    select: {
      uuid: true,
      key: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return { items: rows.map(format_global_target) };
}

/** Menambahkan rentang target global baru. */
export async function createTargetGlobal({ key, target, start_date, end_date }) {
  const config = get_metric_config(key);
  const parsed_target = parse_target_value(target, config);
  const parsed_start_date = parse_target_date(start_date, {
    label: "Tanggal mulai target",
  });
  const parsed_end_date = parse_target_date(end_date, {
    label: "Tanggal selesai target",
  });

  assert_valid_range(parsed_start_date, parsed_end_date);

  if (await find_overlapping_global_target({
    key,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
  })) {
    throw new Error(`Range ${config.label.toLowerCase()} global bentrok dengan data yang sudah ada.`);
  }

  const created_target = await prisma.tbl_target_global.create({
    data: {
      uuid: randomUUID(),
      key,
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      key: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    message: `${config.label} global berhasil ditambahkan.`,
    data: format_global_target(created_target),
  };
}

/** Memperbarui nilai dan rentang target global yang dipilih. */
export async function updateTargetGlobal({
  uuid_target_global,
  key,
  target,
  start_date,
  end_date,
}) {
  if (!uuid_target_global) {
    throw new Error("UUID target global wajib diisi.");
  }

  const config = get_metric_config(key);
  const parsed_target = parse_target_value(target, config);
  const parsed_start_date = parse_target_date(start_date, {
    label: "Tanggal mulai target",
  });
  const parsed_end_date = parse_target_date(end_date, {
    label: "Tanggal selesai target",
  });

  assert_valid_range(parsed_start_date, parsed_end_date);

  const existing_target = await prisma.tbl_target_global.findUnique({
    where: { uuid: uuid_target_global },
    select: { key: true, deleted_at: true },
  });

  if (!existing_target || existing_target.deleted_at || existing_target.key !== key) {
    throw new Error("Data target global tidak ditemukan.");
  }

  if (await find_overlapping_global_target({
    key,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
    exclude_uuid: uuid_target_global,
  })) {
    throw new Error(`Range ${config.label.toLowerCase()} global bentrok dengan data yang sudah ada.`);
  }

  const updated_target = await prisma.tbl_target_global.update({
    where: { uuid: uuid_target_global },
    data: {
      value: parsed_target,
      start_date: parsed_start_date,
      end_date: parsed_end_date,
    },
    select: {
      uuid: true,
      key: true,
      value: true,
      start_date: true,
      end_date: true,
    },
  });

  return {
    success: true,
    message: `${config.label} global berhasil diperbarui.`,
    data: format_global_target(updated_target),
  };
}

/** Menghapus target global yang dipilih secara soft delete. */
export async function deleteTargetGlobal({ uuid_target_global }) {
  if (!uuid_target_global) {
    throw new Error("UUID target global wajib diisi.");
  }

  const existing_target = await prisma.tbl_target_global.findUnique({
    where: { uuid: uuid_target_global },
    select: { key: true, deleted_at: true },
  });

  if (!existing_target || existing_target.deleted_at) {
    throw new Error("Data target global tidak ditemukan.");
  }

  const config = get_metric_config(existing_target.key);

  await prisma.tbl_target_global.update({
    where: { uuid: uuid_target_global },
    data: { deleted_at: new Date() },
  });

  return {
    success: true,
    message: `${config.label} global berhasil dihapus.`,
  };
}

/** Mengubah nilai target dari skala database ke nilai tampilan. */
function format_target_value(value, config) {
  return Number(value ?? 0) / config.scale;
}

/** Memformat record target menjadi struktur data yang digunakan antarmuka. */
function format_target_row(item, config, outlet_by_uuid) {
  const outlet = outlet_by_uuid.get(String(item.uuid_outlet ?? "").trim());

  return {
    uuid: item.uuid,
    uuid_outlet: item.uuid_outlet ?? "",
    outlet_name: outlet?.name ?? "Outlet tidak diketahui",
    target: format_target_value(item.value, config),
    start_date: item.start_date.toISOString().slice(0, 10),
    end_date: item.end_date
      ? item.end_date.toISOString().slice(0, 10)
      : item.start_date.toISOString().slice(0, 10),
  };
}

/** Mencari target outlet lain yang periodenya bertumpang tindih. */
async function find_overlapping_target(config, {
  uuid_outlet,
  start_date,
  end_date,
  exclude_uuid,
}) {
  return prisma[config.model].findFirst({
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
    },
  });
}

/** Memastikan UUID outlet target tersedia pada daftar outlet aktif. */
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

/** Mengambil seluruh target aktif untuk jenis metrik tertentu. */
async function get_target_metric(metric_type) {
  const config = get_metric_config(metric_type);
  const { outlet_by_uuid } = await get_target_outlet_maps();
  const rows = await prisma[config.model].findMany({
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
    items: rows
      .filter((item) =>
        outlet_by_uuid.has(String(item.uuid_outlet ?? "").trim()),
      )
      .map((item) => format_target_row(item, config, outlet_by_uuid)),
  };
}

/** Membuat target baru setelah nilai, outlet, periode, dan bentrok divalidasi. */
async function create_target_metric(metric_type, {
  uuid_outlet,
  target,
  start_date,
  end_date,
}) {
  const config = get_metric_config(metric_type);
  const { outlet_by_uuid } = await get_target_outlet_maps();
  const parsed_target = parse_target_value(target, config);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet = await assert_valid_outlet_uuid(uuid_outlet, outlet_by_uuid);

  assert_valid_range(parsed_start_date, parsed_end_date);

  const overlapping_target = await find_overlapping_target(config, {
    uuid_outlet: resolved_uuid_outlet,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
  });

  if (overlapping_target) {
    throw new Error("Range target bentrok dengan data target outlet ini yang sudah ada.");
  }

  const created_target = await prisma[config.model].create({
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
    data: format_target_row(created_target, config, outlet_by_uuid),
    message: `${config.label} berhasil ditambahkan.`,
  };
}

/** Memperbarui target yang ada setelah memvalidasi record dan periode pengganti. */
async function update_target_metric(metric_type, {
  uuid_target_metric,
  uuid_outlet,
  target,
  start_date,
  end_date,
}) {
  if (!uuid_target_metric) {
    throw new Error("UUID target wajib diisi.");
  }

  const config = get_metric_config(metric_type);
  const { outlet_by_uuid } = await get_target_outlet_maps();
  const parsed_target = parse_target_value(target, config);
  const parsed_start_date = parse_target_date(start_date);
  const parsed_end_date = parse_target_date(end_date);
  const resolved_uuid_outlet = await assert_valid_outlet_uuid(uuid_outlet, outlet_by_uuid);

  assert_valid_range(parsed_start_date, parsed_end_date);

  const existing_target = await prisma[config.model].findUnique({
    where: {
      uuid: uuid_target_metric,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_target || existing_target.deleted_at) {
    throw new Error("Data target tidak ditemukan.");
  }

  const overlapping_target = await find_overlapping_target(config, {
    uuid_outlet: resolved_uuid_outlet,
    start_date: parsed_start_date,
    end_date: parsed_end_date,
    exclude_uuid: uuid_target_metric,
  });

  if (overlapping_target) {
    throw new Error("Range target bentrok dengan data target outlet ini yang sudah ada.");
  }

  const updated_target = await prisma[config.model].update({
    where: {
      uuid: uuid_target_metric,
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
    data: format_target_row(updated_target, config, outlet_by_uuid),
    message: `${config.label} berhasil diperbarui.`,
  };
}

/** Menghapus satu target berdasarkan UUID setelah memastikan record masih aktif. */
async function delete_target_metric(metric_type, { uuid_target_metric }) {
  if (!uuid_target_metric) {
    throw new Error("UUID target wajib diisi.");
  }

  const config = get_metric_config(metric_type);
  const existing_target = await prisma[config.model].findUnique({
    where: {
      uuid: uuid_target_metric,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_target || existing_target.deleted_at) {
    throw new Error("Data target tidak ditemukan.");
  }

  await prisma[config.model].update({
    where: {
      uuid: uuid_target_metric,
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: `${config.label} berhasil dihapus.`,
  };
}

/** Mengimpor target outlet untuk satu metrik dan menolak duplikasi atau bentrok periode. */
async function import_target_metric(metric_type, {
  file_path,
  start_date,
  end_date,
}) {
  const config = get_metric_config(metric_type);
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
    imported_rows.push({
      uuid: randomUUID(),
      uuid_outlet: matched_outlet.uuid,
      value: parse_target_value(row?.target, config),
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

  const overlapping_targets = await prisma[config.model].findMany({
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

  await prisma[config.model].createMany({
    data: imported_rows,
  });

  return {
    success: true,
    message: `Impor ${config.label.toLowerCase()} berhasil untuk ${imported_rows.length} outlet.`,
    data: {
      imported_count: imported_rows.length,
      unmatched_outlets,
      start_date: parsed_start_date.toISOString().slice(0, 10),
      end_date: parsed_end_date.toISOString().slice(0, 10),
    },
  };
}


// ============================================================================
// Public API Target Nilai Transaksi
// ============================================================================

/** Mengambil daftar Target Nilai Transaksi aktif. */
export function getTargetNilaiTransaksi() {
  return get_target_metric("nilai_transaksi");
}

/** Membuat Target Nilai Transaksi baru. */
export function createTargetNilaiTransaksi(payload) {
  return create_target_metric("nilai_transaksi", payload);
}

/** Memperbarui Target Nilai Transaksi yang dipilih. */
export function updateTargetNilaiTransaksi(payload) {
  return update_target_metric("nilai_transaksi", payload);
}

/** Menghapus Target Nilai Transaksi yang dipilih. */
export function deleteTargetNilaiTransaksi(payload) {
  return delete_target_metric("nilai_transaksi", payload);
}

/** Mengimpor Target Nilai Transaksi dari file Excel. */
export function importTargetNilaiTransaksi(payload) {
  return import_target_metric("nilai_transaksi", payload);
}

/** Memperbarui periode banyak Target Nilai Transaksi sekaligus. */
export function bulkUpdateTargetNilaiTransaksiDates(payload) {
  const config = get_metric_config("nilai_transaksi");

  return bulkUpdateTargetDates({
    ...payload,
    model: config.model,
    label: config.label,
  });
}

/** Menghapus banyak Target Nilai Transaksi berdasarkan periode. */
export function bulkDeleteTargetNilaiTransaksi(payload) {
  const config = get_metric_config("nilai_transaksi");

  return bulkDeleteTargetPeriod({
    ...payload,
    model: config.model,
    label: config.label,
  });
}


// ============================================================================
// Public API Target Basket Size
// ============================================================================

/** Mengambil daftar Target Basket Size aktif. */
export function getTargetBasketSize() {
  return get_target_metric("basket_size");
}

/** Membuat Target Basket Size baru. */
export function createTargetBasketSize(payload) {
  return create_target_metric("basket_size", payload);
}

/** Memperbarui Target Basket Size yang dipilih. */
export function updateTargetBasketSize(payload) {
  return update_target_metric("basket_size", payload);
}

/** Menghapus Target Basket Size yang dipilih. */
export function deleteTargetBasketSize(payload) {
  return delete_target_metric("basket_size", payload);
}

/** Mengimpor Target Basket Size dari file Excel. */
export function importTargetBasketSize(payload) {
  return import_target_metric("basket_size", payload);
}

/** Memperbarui periode banyak Target Basket Size sekaligus. */
export function bulkUpdateTargetBasketSizeDates(payload) {
  const config = get_metric_config("basket_size");

  return bulkUpdateTargetDates({
    ...payload,
    model: config.model,
    label: config.label,
  });
}

/** Menghapus banyak Target Basket Size berdasarkan periode. */
export function bulkDeleteTargetBasketSize(payload) {
  const config = get_metric_config("basket_size");

  return bulkDeleteTargetPeriod({
    ...payload,
    model: config.model,
    label: config.label,
  });
}
