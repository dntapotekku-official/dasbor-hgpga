import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  build_relation_key,
  fetch_karyawan_payload,
  fetch_outlet_karyawan_payload,
  fetch_outlet_payload,
  normalize_karyawan_rows,
  normalize_outlet_karyawan_rows,
  normalize_outlet_rows,
} from "@/services/pengaturanSharedService";

export async function syncOutletKaryawan() {
  const [outlet_payload, karyawan_payload, outlet_karyawan_payload] =
    await Promise.all([
      fetch_outlet_payload(),
      fetch_karyawan_payload(),
      fetch_outlet_karyawan_payload(),
    ]);
  const unique_outlet = normalize_outlet_rows(outlet_payload);
  const unique_karyawan = normalize_karyawan_rows(karyawan_payload);
  const valid_outlet_uuid_set = new Set(
    unique_outlet.map((item) => item.uuid),
  );
  const valid_karyawan_uuid_set = new Set(
    unique_karyawan.map((item) => item.uuid),
  );
  const { placement_rows, valid_rows, unique_rows } =
    normalize_outlet_karyawan_rows({
      outlet_karyawan_payload,
      valid_outlet_uuid_set,
      valid_karyawan_uuid_set,
    });
  const existing_karyawan = await prisma.tbl_karyawan.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });
  const existing_karyawan_uuid_set = new Set(
    existing_karyawan.map((item) => item.uuid),
  );
  const existing_relations = await prisma.tbl_outlet_karyawan.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid_outlet: true,
      uuid_karyawan: true,
      is_skip_sync: true,
    },
  });
  const skipped_placement_karyawan_uuid_set = new Set(
    existing_relations
      .filter((item) => item.is_skip_sync)
      .map((item) => item.uuid_karyawan),
  );
  const syncable_outlet_karyawan = unique_rows
    .filter((item) => existing_karyawan_uuid_set.has(item.uuid_karyawan))
    .filter((item) => !skipped_placement_karyawan_uuid_set.has(item.uuid_karyawan));

  await prisma.$transaction(async (tx) => {
    for (const item of syncable_outlet_karyawan) {
      await tx.tbl_outlet_karyawan.upsert({
        where: {
          uuid_outlet_uuid_karyawan: {
            uuid_outlet: item.uuid_outlet,
            uuid_karyawan: item.uuid_karyawan,
          },
        },
        update: {
          deleted_at: null,
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet: item.uuid_outlet,
          uuid_karyawan: item.uuid_karyawan,
        },
      });
    }

    const current_relations = await tx.tbl_outlet_karyawan.findMany({
      where: {
        uuid_karyawan: {
          notIn: Array.from(skipped_placement_karyawan_uuid_set),
        },
        deleted_at: null,
      },
      select: {
        uuid_outlet: true,
        uuid_karyawan: true,
        is_skip_sync: true,
      },
    });
    const incoming_relation_key_set = new Set(
      syncable_outlet_karyawan.map((item) => build_relation_key(item)),
    );
    const removed_relation_keys = current_relations
      .filter((item) => !item.is_skip_sync)
      .filter((item) => !incoming_relation_key_set.has(build_relation_key(item)))
      .map((item) => build_relation_key(item));

    if (removed_relation_keys.length > 0) {
      await Promise.all(
        removed_relation_keys.map((relation_key) => {
          const [uuid_outlet, uuid_karyawan] = relation_key.split(":");

          return tx.tbl_outlet_karyawan.updateMany({
            where: {
              uuid_outlet,
              uuid_karyawan,
              deleted_at: null,
              is_skip_sync: false,
            },
            data: {
              deleted_at: new Date(),
            },
          });
        }),
      );
    }
  });

  return {
    success: true,
    data: {
      data_outlet_karyawan: unique_rows,
    },
    summary: {
      synced_outlet_karyawan: syncable_outlet_karyawan.length,
      skipped_outlet_karyawan:
        placement_rows.length -
        valid_rows.length +
        skipped_placement_karyawan_uuid_set.size +
        (unique_rows.length - syncable_outlet_karyawan.length),
    },
  };
}
