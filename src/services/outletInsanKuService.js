import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dedupeByKey } from "@/lib/utils";
import {
  closeOutletInsanKuInactivePeriod,
  openOutletInsanKuInactivePeriod,
} from "@/services/inactivePeriodService";
import {
  fetchInsanKuPayload,
  fetchOutletInsanKuPayload,
  getInsanKuSettingsData,
  normalizeInsanKuRows,
} from "@/services/insanKuService";

function buildRelationKey({ uuid_outlet, uuid_insanku }) {
  return `${uuid_outlet}:${uuid_insanku}`;
}

function normalizeOutletInsanKuRows({
  outlet_insanku_payload,
  valid_outlet_uuid_set,
  valid_insanku_uuid_set,
}) {
  const placement_rows = Object.entries(outlet_insanku_payload).flatMap(
    ([outlet_key, insanku_list]) => {
      const [uuid_outlet] = outlet_key.split("_");

      if (!Array.isArray(insanku_list)) {
        return [];
      }

      return insanku_list
        .map((item) => {
          const uuid_insanku = String(
            item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
          ).trim();

          if (!uuid_outlet || !uuid_insanku) {
            return null;
          }

          return {
            uuid_outlet,
            uuid_insanku,
          };
        })
        .filter(Boolean);
    },
  );
  const valid_rows = placement_rows.filter(
    (item) =>
      valid_outlet_uuid_set.has(item.uuid_outlet) &&
      valid_insanku_uuid_set.has(item.uuid_insanku),
  );

  return {
    placement_rows,
    valid_rows,
    unique_rows: dedupeByKey(
      valid_rows,
      (item) => `${item.uuid_outlet}:${item.uuid_insanku}`,
    ),
  };
}

export async function syncOutletInsanKu() {
  const [insanku_payload, outlet_insanku_payload, existing_outlets] =
    await Promise.all([
      fetchInsanKuPayload(),
      fetchOutletInsanKuPayload(),
      prisma.tbl_outlet.findMany({
        where: {
          deleted_at: null,
          is_active: true,
          excep: false,
        },
        select: {
          uuid: true,
        },
      }),
    ]);
  const unique_insanku = normalizeInsanKuRows(insanku_payload);
  const valid_outlet_uuid_set = new Set(
    existing_outlets.map((item) => item.uuid),
  );
  const valid_insanku_uuid_set = new Set(
    unique_insanku.map((item) => item.uuid),
  );
  const { placement_rows, valid_rows, unique_rows } =
    normalizeOutletInsanKuRows({
      outlet_insanku_payload,
      valid_outlet_uuid_set,
      valid_insanku_uuid_set,
    });
  const existing_insanku = await prisma.tbl_insanku.findMany({
    where: {
      deleted_at: null,
      is_active: true,
    },
    select: {
      uuid: true,
    },
  });
  const existing_insanku_uuid_set = new Set(
    existing_insanku.map((item) => item.uuid),
  );
  const existing_relations = await prisma.tbl_outlet_insanku.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid_outlet: true,
      uuid_insanku: true,
      is_skip_sync: true,
    },
  });
  const skipped_placement_insanku_uuid_set = new Set(
    existing_relations
      .filter((item) => item.is_skip_sync)
      .map((item) => item.uuid_insanku),
  );
  const syncable_outlet_insanku = unique_rows
    .filter((item) => existing_insanku_uuid_set.has(item.uuid_insanku))
    .filter((item) => !skipped_placement_insanku_uuid_set.has(item.uuid_insanku));

  await prisma.$transaction(async (tx) => {
    for (const item of syncable_outlet_insanku) {
      await tx.tbl_outlet_insanku.upsert({
        where: {
          uuid_outlet_uuid_insanku: {
            uuid_outlet: item.uuid_outlet,
            uuid_insanku: item.uuid_insanku,
          },
        },
        update: {
          deleted_at: null,
          is_active: true,
          is_skip_sync: false,
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet: item.uuid_outlet,
          uuid_insanku: item.uuid_insanku,
          is_active: true,
        },
      });
      const active_relation = await tx.tbl_outlet_insanku.findUnique({
        where: {
          uuid_outlet_uuid_insanku: {
            uuid_outlet: item.uuid_outlet,
            uuid_insanku: item.uuid_insanku,
          },
        },
        select: { uuid: true },
      });

      if (active_relation) {
        await closeOutletInsanKuInactivePeriod(tx, active_relation.uuid);
      }
    }

    const current_relations = await tx.tbl_outlet_insanku.findMany({
      where: {
        uuid_insanku: {
          notIn: Array.from(skipped_placement_insanku_uuid_set),
          in: Array.from(valid_insanku_uuid_set),
        },
        uuid_outlet: {
          in: Array.from(valid_outlet_uuid_set),
        },
        deleted_at: null,
      },
      select: {
        uuid_outlet: true,
        uuid_insanku: true,
        is_skip_sync: true,
      },
    });
    const incoming_relation_key_set = new Set(
      syncable_outlet_insanku.map((item) => buildRelationKey(item)),
    );
    const removed_relation_keys = current_relations
      .filter((item) => !item.is_skip_sync)
      .filter((item) => !incoming_relation_key_set.has(buildRelationKey(item)))
      .map((item) => buildRelationKey(item));

    if (removed_relation_keys.length > 0) {
      const deleted_at = new Date();

      await Promise.all(
        removed_relation_keys.map((relation_key) => {
          const [uuid_outlet, uuid_insanku] = relation_key.split(":");

          return tx.tbl_outlet_insanku
            .findMany({
              where: {
                uuid_outlet,
                uuid_insanku,
                deleted_at: null,
                is_skip_sync: false,
              },
              select: { uuid: true },
            })
            .then(async (relations) => {
              await tx.tbl_outlet_insanku.updateMany({
                where: {
                  uuid: {
                    in: relations.map((item) => item.uuid),
                  },
                },
                data: {
                  is_active: false,
                },
              });

              await Promise.all(
                relations.map((relation) =>
                  openOutletInsanKuInactivePeriod(tx, relation.uuid, deleted_at),
                ),
              );
            });
        }),
      );
    }
  });

  return {
    success: true,
    data: {
      data_outlet_insanku: unique_rows,
    },
    summary: {
      synced_outlet_insanku: syncable_outlet_insanku.length,
      skipped_outlet_insanku:
        placement_rows.length -
        valid_rows.length +
        skipped_placement_insanku_uuid_set.size +
        (unique_rows.length - syncable_outlet_insanku.length),
    },
  };
}

export async function getOutletInsanKu() {
  const data_insanku = await getInsanKuSettingsData();

  return {
    data_outlet_insanku: data_insanku.map((item) => ({
      uuid_insanku: item.uuid,
      name: item.name,
      username: item.username,
      outlet_uuids: item.outlet_uuids,
      outlet_names: item.outlet_names,
      is_skip_sync_outlet_insanku: item.is_skip_sync_outlet_insanku,
    })),
  };
}

export async function updateOutletInsanKu({
  uuid_insanku,
  outlet_uuids = [],
  is_skip_sync_outlet_insanku,
}) {
  if (!uuid_insanku) {
    throw new Error("UUID InsanKu wajib diisi.");
  }

  const unique_outlet_uuids = Array.from(
    new Set(
      Array.isArray(outlet_uuids)
        ? outlet_uuids.map((item) => String(item).trim()).filter(Boolean)
        : [],
    ),
  );

  const should_skip_sync =
    Boolean(is_skip_sync_outlet_insanku) && unique_outlet_uuids.length > 0;

  const existing_insanku = await prisma.tbl_insanku.findUnique({
    where: { uuid: uuid_insanku },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_insanku || existing_insanku.deleted_at) {
    throw new Error("Data InsanKu tidak ditemukan.");
  }

  const valid_outlets = await prisma.tbl_outlet.findMany({
    where: {
      uuid: {
        in: unique_outlet_uuids,
      },
      deleted_at: null,
      is_active: true,
      excep: false,
    },
    select: {
      uuid: true,
    },
  });
  const valid_outlet_uuid_set = new Set(valid_outlets.map((item) => item.uuid));

  if (valid_outlet_uuid_set.size !== unique_outlet_uuids.length) {
    throw new Error("Sebagian outlet yang dipilih tidak ditemukan.");
  }

  await prisma.$transaction(async (tx) => {
    const current_relations = await tx.tbl_outlet_insanku.findMany({
      where: {
        uuid_insanku,
        deleted_at: null,
      },
      select: {
        uuid_outlet: true,
        uuid: true,
      },
    });
    const current_outlet_uuid_set = new Set(
      current_relations.map((item) => item.uuid_outlet),
    );

    for (const uuid_outlet of unique_outlet_uuids) {
      await tx.tbl_outlet_insanku.upsert({
        where: {
          uuid_outlet_uuid_insanku: {
            uuid_outlet,
            uuid_insanku,
          },
        },
        update: {
          deleted_at: null,
          is_active: true,
          is_skip_sync: should_skip_sync,
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet,
          uuid_insanku,
          is_active: true,
          is_skip_sync: should_skip_sync,
        },
      });
      const active_relation = await tx.tbl_outlet_insanku.findUnique({
        where: {
          uuid_outlet_uuid_insanku: {
            uuid_outlet,
            uuid_insanku,
          },
        },
        select: { uuid: true },
      });

      if (active_relation) {
        await closeOutletInsanKuInactivePeriod(tx, active_relation.uuid);
      }
    }

    await tx.tbl_outlet_insanku.updateMany({
      where: {
        uuid_insanku,
        deleted_at: null,
      },
      data: {
        is_skip_sync: should_skip_sync,
      },
    });

    const outlet_uuids_to_remove = Array.from(current_outlet_uuid_set).filter(
      (item) => !valid_outlet_uuid_set.has(item),
    );

    if (outlet_uuids_to_remove.length > 0) {
      await tx.tbl_outlet_insanku.updateMany({
        where: {
          uuid_insanku,
          uuid_outlet: {
            in: outlet_uuids_to_remove,
          },
        },
        data: {
          is_active: false,
        },
      });
      const removed_relations = await tx.tbl_outlet_insanku.findMany({
        where: {
          uuid_insanku,
          uuid_outlet: {
            in: outlet_uuids_to_remove,
          },
          deleted_at: null,
        },
        select: { uuid: true },
      });

      await Promise.all(
        removed_relations.map((relation) =>
          openOutletInsanKuInactivePeriod(tx, relation.uuid),
        ),
      );
    }
  });

  const refreshed_data = await getOutletInsanKu();
  const updated_outlet_insanku = refreshed_data.data_outlet_insanku.find(
    (item) => item.uuid_insanku === uuid_insanku,
  );

  return {
    success: true,
    data: updated_outlet_insanku ?? null,
    message: "Data penempatan berhasil diperbarui.",
  };
}
