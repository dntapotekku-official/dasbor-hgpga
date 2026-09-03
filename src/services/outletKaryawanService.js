import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dedupeByKey } from "@/lib/utils";
import {
  fetchKaryawanPayload,
  getKaryawanSettingsData,
  normalizeKaryawanRows,
} from "@/services/karyawanService";
import {
  fetchOutletPayload,
  normalizeOutletRows,
} from "@/services/outletService";

function buildRelationKey({ uuid_outlet, uuid_karyawan }) {
  return `${uuid_outlet}:${uuid_karyawan}`;
}

export async function fetchOutletKaryawanPayload() {
  const url =
    process.env.OUTLET_KARYAWAN_SLIP_GAJI_API_URL ??
    process.env.OUTLET_KARYAWAN_SLIPGAJI_API_URL;

  if (!url) {
    throw new Error("Environment variable OUTLET_KARYAWAN_SLIP_GAJI_API_URL belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(
      `Gagal menyinkronkan OUTLET_KARYAWAN_SLIP_GAJI_API_URL: ${result.status}`,
    );
  }

  const response = await result.json();

  return response.data ?? response;
}

export function normalizeOutletKaryawanRows({
  outlet_karyawan_payload,
  valid_outlet_uuid_set,
  valid_karyawan_uuid_set,
}) {
  const placement_rows = Object.entries(outlet_karyawan_payload).flatMap(
    ([outlet_key, karyawan_list]) => {
      const [uuid_outlet] = outlet_key.split("_");

      if (!Array.isArray(karyawan_list)) {
        return [];
      }

      return karyawan_list
        .map((item) => {
          const uuid_karyawan = String(
            item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
          ).trim();

          if (!uuid_outlet || !uuid_karyawan) {
            return null;
          }

          return {
            uuid_outlet,
            uuid_karyawan,
          };
        })
        .filter(Boolean);
    },
  );
  const valid_rows = placement_rows.filter(
    (item) =>
      valid_outlet_uuid_set.has(item.uuid_outlet) &&
      valid_karyawan_uuid_set.has(item.uuid_karyawan),
  );

  return {
    placement_rows,
    valid_rows,
    unique_rows: dedupeByKey(
      valid_rows,
      (item) => `${item.uuid_outlet}:${item.uuid_karyawan}`,
    ),
  };
}

export async function syncOutletKaryawan() {
  const [outlet_payload, karyawan_payload, outlet_karyawan_payload] =
    await Promise.all([
      fetchOutletPayload(),
      fetchKaryawanPayload(),
      fetchOutletKaryawanPayload(),
    ]);
  const unique_outlet = normalizeOutletRows(outlet_payload);
  const unique_karyawan = normalizeKaryawanRows(karyawan_payload);
  const valid_outlet_uuid_set = new Set(
    unique_outlet.map((item) => item.uuid),
  );
  const valid_karyawan_uuid_set = new Set(
    unique_karyawan.map((item) => item.uuid),
  );
  const { placement_rows, valid_rows, unique_rows } =
    normalizeOutletKaryawanRows({
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
      syncable_outlet_karyawan.map((item) => buildRelationKey(item)),
    );
    const removed_relation_keys = current_relations
      .filter((item) => !item.is_skip_sync)
      .filter((item) => !incoming_relation_key_set.has(buildRelationKey(item)))
      .map((item) => buildRelationKey(item));

    if (removed_relation_keys.length > 0) {
      const removed_relations = await tx.tbl_outlet_karyawan.findMany({
        where: {
          OR: removed_relation_keys.map((relation_key) => {
            const [uuid_outlet, uuid_karyawan] = relation_key.split(":");

            return {
              uuid_outlet,
              uuid_karyawan,
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
            uuid_outlet_karyawan: {
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
          const [uuid_outlet, uuid_karyawan] = relation_key.split(":");

          return tx.tbl_outlet_karyawan.updateMany({
            where: {
              uuid_outlet,
              uuid_karyawan,
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

export async function getOutletKaryawan() {
  const data_karyawan = await getKaryawanSettingsData();

  return {
    data_outlet_karyawan: data_karyawan.map((item) => ({
      uuid_karyawan: item.uuid,
      name: item.name,
      username: item.username,
      outlet_uuids: item.outlet_uuids,
      outlet_names: item.outlet_names,
      is_skip_sync_outlet_karyawan: item.is_skip_sync_outlet_karyawan,
    })),
  };
}

export async function updateOutletKaryawan({
  uuid_karyawan,
  outlet_uuids = [],
  is_skip_sync_outlet_karyawan,
}) {
  if (!uuid_karyawan) {
    throw new Error("UUID karyawan wajib diisi.");
  }

  const unique_outlet_uuids = Array.from(
    new Set(
      Array.isArray(outlet_uuids)
        ? outlet_uuids.map((item) => String(item).trim()).filter(Boolean)
        : [],
    ),
  );

  if (Boolean(is_skip_sync_outlet_karyawan) && unique_outlet_uuids.length === 0) {
    throw new Error("Lewati sinkron penempatan hanya bisa dipakai jika karyawan punya outlet.");
  }

  const existing_karyawan = await prisma.tbl_karyawan.findUnique({
    where: { uuid: uuid_karyawan },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_karyawan || existing_karyawan.deleted_at) {
    throw new Error("Data karyawan tidak ditemukan.");
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
    const current_relations = await tx.tbl_outlet_karyawan.findMany({
      where: {
        uuid_karyawan,
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
      await tx.tbl_outlet_karyawan.upsert({
        where: {
          uuid_outlet_uuid_karyawan: {
            uuid_outlet,
            uuid_karyawan,
          },
        },
        update: {
          deleted_at: null,
          is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet,
          uuid_karyawan,
          is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
        },
      });
    }

    await tx.tbl_outlet_karyawan.updateMany({
      where: {
        uuid_karyawan,
        deleted_at: null,
      },
      data: {
        is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
      },
    });

    const outlet_uuids_to_remove = Array.from(current_outlet_uuid_set).filter(
      (item) => !valid_outlet_uuid_set.has(item),
    );

    if (outlet_uuids_to_remove.length > 0) {
      await tx.tbl_outlet_karyawan.updateMany({
        where: {
          uuid_karyawan,
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

  const refreshed_data = await getOutletKaryawan();
  const updated_outlet_karyawan = refreshed_data.data_outlet_karyawan.find(
    (item) => item.uuid_karyawan === uuid_karyawan,
  );

  return {
    success: true,
    data: updated_outlet_karyawan ?? null,
    message: "Data penempatan berhasil diperbarui.",
  };
}
