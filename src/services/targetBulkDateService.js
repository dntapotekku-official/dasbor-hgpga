import { prisma } from "@/lib/prisma";
import {
  assert_valid_range,
  get_target_outlet_maps,
  parse_target_date,
} from "@/services/targetImportService";

function get_source_end_date_filter(source_start_date, source_end_date) {
  if (source_start_date.getTime() === source_end_date.getTime()) {
    return [
      { end_date: source_end_date },
      { end_date: null },
    ];
  }

  return [{ end_date: source_end_date }];
}

export async function bulkUpdateTargetDates({
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

export async function bulkDeleteTargetPeriod({
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

    const result = await target_model.deleteMany({
      where: {
        uuid: {
          in: selected_targets.map((item) => item.uuid),
        },
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
