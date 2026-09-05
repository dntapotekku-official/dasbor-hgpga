import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dedupeByKey } from "@/lib/utils";
import {
  fetchInsanKuPayload,
  getInsanKuSettingsData,
  normalizeInsanKuRows,
} from "@/services/insanKuService";
import {
  fetchOutletPayload,
  normalizeOutletRows,
} from "@/services/outletService";

function buildRelationKey({ uuid_outlet, uuid_insanku }) {
  return `${uuid_outlet}:${uuid_insanku}`;
}

async function fetchOutletInsanKuPayload() {
  const url =
    process.env.OUTLET_INSANKU_SLIP_GAJI_API_URL ??
    process.env.OUTLET_INSANKU_SLIPGAJI_API_URL ??
    process.env.OUTLET_KARYAWAN_SLIP_GAJI_API_URL ??
    process.env.OUTLET_KARYAWAN_SLIPGAJI_API_URL;

  if (!url) {
    throw new Error("Environment variable OUTLET_INSANKU_SLIP_GAJI_API_URL belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(
      `Gagal menyinkronkan OUTLET_INSANKU_SLIP_GAJI_API_URL: ${result.status}`,
    );
  }

  const response = await result.json();

  return response.data ?? response;
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
  const [outlet_payload, insanku_payload, outlet_insanku_payload] =
    await Promise.all([
      fetchOutletPayload(),
      fetchInsanKuPayload(),
      fetchOutletInsanKuPayload(),
    ]);
  const unique_outlet = normalizeOutletRows(outlet_payload);
  const unique_insanku = normalizeInsanKuRows(insanku_payload);
  const valid_outlet_uuid_set = new Set(
    unique_outlet.map((item) => item.uuid),
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
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet: item.uuid_outlet,
          uuid_insanku: item.uuid_insanku,
        },
      });
    }

    const current_relations = await tx.tbl_outlet_insanku.findMany({
      where: {
        uuid_insanku: {
          notIn: Array.from(skipped_placement_insanku_uuid_set),
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
      const removed_relations = await tx.tbl_outlet_insanku.findMany({
        where: {
          OR: removed_relation_keys.map((relation_key) => {
            const [uuid_outlet, uuid_insanku] = relation_key.split(":");

            return {
              uuid_outlet,
              uuid_insanku,
              deleted_at: null,
              is_skip_sync: false,
            };
          }),
        },
        select: {
          uuid: true,
        },
      });
      const removed_relation_uuids = removed_relations.map((item) => item.uuid);
      const deleted_at = new Date();

      if (removed_relation_uuids.length > 0) {
        await tx.tbl_penjualan_gofitku.updateMany({
          where: {
            uuid_outlet_insanku: {
              in: removed_relation_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        });
      }

      await Promise.all(
        removed_relation_keys.map((relation_key) => {
          const [uuid_outlet, uuid_insanku] = relation_key.split(":");

          return tx.tbl_outlet_insanku.updateMany({
            where: {
              uuid_outlet,
              uuid_insanku,
              deleted_at: null,
              is_skip_sync: false,
            },
            data: {
              deleted_at,
            },
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

  if (Boolean(is_skip_sync_outlet_insanku) && unique_outlet_uuids.length === 0) {
    throw new Error("Lewati sinkron penempatan hanya bisa dipakai jika InsanKu punya outlet.");
  }

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
          is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet,
          uuid_insanku,
          is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
        },
      });
    }

    await tx.tbl_outlet_insanku.updateMany({
      where: {
        uuid_insanku,
        deleted_at: null,
      },
      data: {
        is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
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
          deleted_at: new Date(),
        },
      });
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
