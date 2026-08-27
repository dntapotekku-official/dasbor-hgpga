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
    data_target_gofitku: data_target_gofitku.map((item) =>
      format_target_row(item, outlet_by_uuid),
    ),
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

  await prisma.tbl_target_gofitku.delete({
    where: {
      uuid: uuid_target_gofitku,
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
