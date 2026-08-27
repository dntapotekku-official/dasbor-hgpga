import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  bulkDeleteTargetPeriod,
  bulkUpdateTargetDates,
} from "@/services/targetBulkDateService";
import {
  assert_valid_range,
  get_target_outlet_maps,
  normalize_target_outlet_name,
  parse_target_date,
  parse_target_report_workbook,
} from "@/services/targetImportService";

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
    scale: 100,
    allow_decimal: true,
  },
};

function get_metric_config(metric_type) {
  const config = target_metric_config[metric_type];

  if (!config) {
    throw new Error("Jenis target tidak dikenali.");
  }

  return config;
}

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
  const stored_target = Math.round(scaled_target);

  if (config.allow_decimal && Math.abs(scaled_target - stored_target) > 1e-9) {
    throw new Error("Nilai target maksimal memiliki 2 angka desimal.");
  }

  return stored_target;
}

function format_target_value(value, config) {
  return Number(value ?? 0) / config.scale;
}

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
    items: rows.map((item) => format_target_row(item, config, outlet_by_uuid)),
  };
}

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

  await prisma[config.model].delete({
    where: {
      uuid: uuid_target_metric,
    },
  });

  return {
    success: true,
    message: `${config.label} berhasil dihapus.`,
  };
}

async function import_target_metric(metric_type, {
  file_path,
  import_date,
}) {
  const config = get_metric_config(metric_type);
  const parsed_import_date = parse_target_date(import_date, {
    label: "Tanggal impor",
  });
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
      start_date: parsed_import_date,
      end_date: parsed_import_date,
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
        lte: parsed_import_date,
      },
      OR: [
        {
          end_date: null,
        },
        {
          end_date: {
            gte: parsed_import_date,
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
      `Impor dibatalkan karena target bentrok pada tanggal ini untuk outlet: ${overlapping_outlet_names.join(", ")}.`,
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
      import_date: parsed_import_date.toISOString().slice(0, 10),
    },
  };
}

export function getTargetNilaiTransaksi() {
  return get_target_metric("nilai_transaksi");
}

export function createTargetNilaiTransaksi(payload) {
  return create_target_metric("nilai_transaksi", payload);
}

export function updateTargetNilaiTransaksi(payload) {
  return update_target_metric("nilai_transaksi", payload);
}

export function deleteTargetNilaiTransaksi(payload) {
  return delete_target_metric("nilai_transaksi", payload);
}

export function importTargetNilaiTransaksi(payload) {
  return import_target_metric("nilai_transaksi", payload);
}

export function bulkUpdateTargetNilaiTransaksiDates(payload) {
  const config = get_metric_config("nilai_transaksi");

  return bulkUpdateTargetDates({
    ...payload,
    model: config.model,
    label: config.label,
  });
}

export function bulkDeleteTargetNilaiTransaksi(payload) {
  const config = get_metric_config("nilai_transaksi");

  return bulkDeleteTargetPeriod({
    ...payload,
    model: config.model,
    label: config.label,
  });
}

export function getTargetBasketSize() {
  return get_target_metric("basket_size");
}

export function createTargetBasketSize(payload) {
  return create_target_metric("basket_size", payload);
}

export function updateTargetBasketSize(payload) {
  return update_target_metric("basket_size", payload);
}

export function deleteTargetBasketSize(payload) {
  return delete_target_metric("basket_size", payload);
}

export function importTargetBasketSize(payload) {
  return import_target_metric("basket_size", payload);
}

export function bulkUpdateTargetBasketSizeDates(payload) {
  const config = get_metric_config("basket_size");

  return bulkUpdateTargetDates({
    ...payload,
    model: config.model,
    label: config.label,
  });
}

export function bulkDeleteTargetBasketSize(payload) {
  const config = get_metric_config("basket_size");

  return bulkDeleteTargetPeriod({
    ...payload,
    model: config.model,
    label: config.label,
  });
}
