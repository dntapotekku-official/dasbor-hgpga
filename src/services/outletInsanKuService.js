import { randomUUID } from "node:crypto";
import { buildDefaultPlacementTarget } from "@/services/defaultPlacementTarget";
import { prisma } from "@/lib/prisma";
import { dedupeByKey } from "@/lib/utils";
import {
  closeOutletInsanKuInactivePeriod,
  openOutletInsanKuInactivePeriod,
} from "@/services/inactivePeriodService";
import {
  fetchInsanKuPayload,
  fetchJabatanInsanKuPayload,
  fetchJabatanPayload,
  fetchOutletInsanKuPayload,
  getInsanKuSettingsData,
  normalizeInsanKuRows,
} from "@/services/insanKuService";

function buildRelationKey({ uuid_outlet, uuid_insanku }) {
  return `${uuid_outlet}:${uuid_insanku}`;
}

function getOutletInsanKuPayloadOutletUuid(outlet_key, item) {
  const [uuid_from_key] = String(outlet_key ?? "").split("_");

  return String(
    item?.cabangs_id ??
      item?.id_cabang ??
      item?.uuid_outlet ??
      item?.outlet_uuid ??
      uuid_from_key ??
      "",
  ).trim();
}

function getOutletInsanKuPayloadInsanKuUuid(item) {
  return String(
    item?.karyawans_id ??
      item?.id_karyawans ??
      item?.id_karyawan ??
      item?.uuid_insanku ??
      item?.uuid ??
      item?.id ??
      "",
  ).trim();
}

function getOutletInsanKuPayloadJabatanUuid(item) {
  return String(
    item?.jabatans_id ??
      item?.id_jabatan ??
      item?.uuid_jabatan ??
      item?.jabatan_uuid ??
      "",
  ).trim();
}

function getJabatanPayloadUuid(item) {
  return String(
    item?.id_jabatans ??
      item?.jabatans_id ??
      item?.id_jabatan ??
      item?.uuid ??
      item?.id ??
      "",
  ).trim();
}

function getJabatanPayloadName(item, uuid) {
  return String(
    item?.nama_jabatan ??
      item?.nama ??
      item?.name ??
      item?.jabatan ??
      uuid ??
      "",
  ).trim();
}

function normalizeJabatanRows(jabatan_payload) {
  if (!Array.isArray(jabatan_payload)) {
    return [];
  }

  return dedupeByKey(
    jabatan_payload
      .map((item) => {
        const uuid = getJabatanPayloadUuid(item);

        if (!uuid) {
          return null;
        }

        return {
          uuid,
          name: getJabatanPayloadName(item, uuid) || uuid,
        };
      })
      .filter(Boolean),
    (item) => item.uuid,
  );
}

function flattenPayloadLists(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Object.values(payload ?? {}).flatMap((value) =>
    Array.isArray(value) ? value : [],
  );
}

function buildJabatanRelationMap(jabatan_insanku_payload) {
  const rows = flattenPayloadLists(jabatan_insanku_payload);
  const relation_map = new Map();

  for (const item of rows) {
    const uuid_outlet = getOutletInsanKuPayloadOutletUuid("", item);
    const uuid_insanku = getOutletInsanKuPayloadInsanKuUuid(item);
    const uuid_jabatan_master = getOutletInsanKuPayloadJabatanUuid(item);

    if (!uuid_outlet || !uuid_insanku || !uuid_jabatan_master) {
      continue;
    }

    relation_map.set(buildRelationKey({ uuid_outlet, uuid_insanku }), {
      uuid_outlet,
      uuid_insanku,
      uuid_jabatan_master,
    });
  }

  return relation_map;
}

function normalizeOutletInsanKuRows({
  outlet_insanku_payload,
  valid_outlet_uuid_set,
  valid_insanku_uuid_set,
}) {
  const payload_entries = Array.isArray(outlet_insanku_payload)
    ? [["", outlet_insanku_payload]]
    : Object.entries(outlet_insanku_payload ?? {});
  const placement_rows = payload_entries.flatMap(
    ([outlet_key, insanku_list]) => {
      if (!Array.isArray(insanku_list)) {
        return [];
      }

      return insanku_list
        .map((item) => {
          const uuid_outlet = getOutletInsanKuPayloadOutletUuid(
            outlet_key,
            item,
          );
          const uuid_insanku = getOutletInsanKuPayloadInsanKuUuid(item);

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

async function upsertJabatanInsanKu(
  transaction,
  { jabatan_master_map, uuid_outlet_insanku, uuid_jabatan_master },
) {
  if (!uuid_outlet_insanku || !uuid_jabatan_master) {
    return false;
  }

  const jabatan_master = jabatan_master_map.get(uuid_jabatan_master);

  await transaction.tbl_jabatan_master.upsert({
    where: { uuid: uuid_jabatan_master },
    update: {
      ...(jabatan_master?.name ? { name: jabatan_master.name } : {}),
      deleted_at: null,
    },
    create: {
      uuid: uuid_jabatan_master,
      name: jabatan_master?.name || uuid_jabatan_master,
    },
  });

  await transaction.tbl_jabatan_insanku.upsert({
    where: { uuid_outlet_insanku },
    update: {
      uuid_jabatan_master,
      is_active: true,
      deleted_at: null,
    },
    create: {
      uuid: randomUUID(),
      uuid_outlet_insanku,
      uuid_jabatan_master,
      is_active: true,
    },
  });

  return true;
}

export async function syncOutletInsanKu() {
  const [
    insanku_payload,
    outlet_insanku_payload,
    jabatan_payload,
    jabatan_insanku_payload,
    existing_outlets,
  ] =
    await Promise.all([
      fetchInsanKuPayload(),
      fetchOutletInsanKuPayload(),
      fetchJabatanPayload(),
      fetchJabatanInsanKuPayload(),
      prisma.tbl_outlet.findMany({
        where: {
          deleted_at: null,
          is_active: true,
          is_excluded: false,
        },
        select: {
          uuid: true,
        },
      }),
    ]);
  const jabatan_master_rows = normalizeJabatanRows(jabatan_payload);
  const jabatan_master_map = new Map(
    jabatan_master_rows.map((item) => [item.uuid, item]),
  );
  const jabatan_relation_map = buildJabatanRelationMap(jabatan_insanku_payload);
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
  let synced_jabatan_insanku = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const item of syncable_outlet_insanku) {
        const active_relation = await tx.tbl_outlet_insanku.upsert({
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
            target_gofitku: buildDefaultPlacementTarget(),
          },
          select: { uuid: true },
        });

        if (active_relation) {
          await closeOutletInsanKuInactivePeriod(tx, active_relation.uuid);

          const is_jabatan_synced = await upsertJabatanInsanKu(tx, {
            jabatan_master_map,
            uuid_outlet_insanku: active_relation.uuid,
            uuid_jabatan_master: jabatan_relation_map.get(
              buildRelationKey(item),
            )?.uuid_jabatan_master,
          });

          if (is_jabatan_synced) {
            synced_jabatan_insanku += 1;
          }
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
        .filter(
          (item) => !incoming_relation_key_set.has(buildRelationKey(item)),
        )
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
                const relation_uuids = relations.map((item) => item.uuid);

                await tx.tbl_outlet_insanku.updateMany({
                  where: {
                    uuid: {
                      in: relation_uuids,
                    },
                  },
                  data: {
                    is_active: false,
                  },
                });
                await tx.tbl_jabatan_insanku.updateMany({
                  where: {
                    uuid_outlet_insanku: {
                      in: relation_uuids,
                    },
                    deleted_at: null,
                  },
                  data: {
                    is_active: false,
                  },
                });

                await Promise.all(
                  relations.map((relation) =>
                    openOutletInsanKuInactivePeriod(
                      tx,
                      relation.uuid,
                      deleted_at,
                    ),
                  ),
                );
              });
          }),
        );
      }
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

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
      synced_jabatan_insanku,
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
    throw new Error("UUID InsanKU wajib diisi.");
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
    throw new Error("Data InsanKU tidak ditemukan.");
  }

  const valid_outlets = await prisma.tbl_outlet.findMany({
    where: {
      uuid: {
        in: unique_outlet_uuids,
      },
      deleted_at: null,
      is_active: true,
      is_excluded: false,
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
          target_gofitku: buildDefaultPlacementTarget(),
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
