import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { dedupeByUuid } from "@/lib/utils";

export async function fetchKaryawanPayload() {
  const url =
    process.env.KARYAWAN_SLIP_GAJI_API_URL ??
    process.env.KARYAWAN_SLIPGAJI_API_URL;

  if (!url) {
    throw new Error("Environment variable KARYAWAN_SLIP_GAJI_API_URL belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan KARYAWAN_SLIP_GAJI_API_URL: ${result.status}`);
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error("Response KARYAWAN_SLIP_GAJI_API_URL harus berupa array data karyawan.");
  }

  return payload;
}

export function normalizeKaryawanRows(karyawan_payload) {
  const data_karyawan = karyawan_payload
    .map((item) => {
      const uuid = String(
        item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
      ).trim();
      const base_username = String(
        item?.username ?? item?.nip ?? item?.nik ?? "",
      ).trim();

      if (!uuid) {
        return null;
      }

      return {
        uuid,
        name: String(item?.nama ?? item?.name ?? "-").trim() || "-",
        username: base_username ? `${base_username}@apotekku` : `${uuid}@apotekku`,
        password: item?.password ?? "apotekku",
        is_username_change: false,
        is_password_change: false,
        avatar: item?.foto_profile ?? item?.avatar ?? null,
        role: "member",
      };
    })
    .filter(Boolean);

  return dedupeByUuid(data_karyawan);
}

export async function getKaryawanSettingsData() {
  const data_karyawan = await prisma.tbl_karyawan.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      is_skip_sync: true,
      outlet_karyawan: {
        where: {
          deleted_at: null,
          outlet: {
            deleted_at: null,
          },
        },
        orderBy: {
          outlet: {
            name: "asc",
          },
        },
        select: {
          uuid: true,
          is_skip_sync: true,
          outlet: {
            select: { uuid: true, name: true },
          },
        },
      },
    },
  });

  return data_karyawan.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    username: item.username,
    is_skip_sync_karyawan: Boolean(item.is_skip_sync),
    is_skip_sync_outlet_karyawan: item.outlet_karyawan.some(
      (outlet_karyawan) => outlet_karyawan.is_skip_sync,
    ),
    outlet_uuids:
      item.outlet_karyawan.length > 0
        ? item.outlet_karyawan.map((outlet_karyawan) => outlet_karyawan.outlet.uuid)
        : [],
    outlet_names:
      item.outlet_karyawan.length > 0
        ? item.outlet_karyawan.map((outlet_karyawan) => outlet_karyawan.outlet.name)
        : [],
    outlet_placements:
      item.outlet_karyawan.length > 0
        ? item.outlet_karyawan.map((outlet_karyawan) => ({
            uuid: outlet_karyawan.uuid,
            outlet_uuid: outlet_karyawan.outlet.uuid,
            outlet_name: outlet_karyawan.outlet.name,
          }))
        : [],
  }));
}

export async function syncKaryawan() {
  const karyawan_payload = await fetchKaryawanPayload();
  const unique_karyawan = normalizeKaryawanRows(karyawan_payload);
  const incoming_karyawan_uuid_set = new Set(
    unique_karyawan.map((item) => item.uuid),
  );
  const existing_karyawan = await prisma.tbl_karyawan.findMany({
    select: {
      uuid: true,
      username: true,
      password: true,
      is_skip_sync: true,
      deleted_at: true,
    },
  });
  const existing_karyawan_map = new Map(
    existing_karyawan.map((item) => [item.uuid, item]),
  );
  const new_karyawan = unique_karyawan.filter(
    (item) => !existing_karyawan_map.has(item.uuid),
  );
  const update_karyawan = unique_karyawan
    .filter((item) => existing_karyawan_map.has(item.uuid))
    .filter((item) => !existing_karyawan_map.get(item.uuid)?.is_skip_sync)
    .map((item) => {
      const existing_item = existing_karyawan_map.get(item.uuid);

      return {
        ...item,
        username:
          existing_item?.username && existing_item.username !== item.username
            ? existing_item.username
            : item.username,
        password: existing_item?.password ?? item.password,
      };
    });
  const skipped_karyawan = unique_karyawan.filter(
    (item) => existing_karyawan_map.get(item.uuid)?.is_skip_sync,
  );
  const deleted_karyawan = existing_karyawan.filter(
    (item) =>
      !incoming_karyawan_uuid_set.has(item.uuid) &&
      !item.is_skip_sync &&
      item.deleted_at === null,
  );
  const skipped_deleted_karyawan = existing_karyawan.filter(
    (item) =>
      !incoming_karyawan_uuid_set.has(item.uuid) &&
      item.is_skip_sync &&
      item.deleted_at === null,
  );

  await prisma.$transaction(async (tx) => {
    if (new_karyawan.length > 0) {
      await tx.tbl_karyawan.createMany({
        data: new_karyawan,
        skipDuplicates: true,
      });
    }

    await Promise.all(
      update_karyawan.map((item) =>
        tx.tbl_karyawan.update({
          where: { uuid: item.uuid },
          data: {
            name: item.name,
            username: `${item.username}@apotekku`,
            password: item.password,
            avatar: item.avatar,
            role: item.role,
            deleted_at: null,
          },
        }),
      ),
    );

    if (deleted_karyawan.length > 0) {
      const deleted_karyawan_uuids = deleted_karyawan.map((item) => item.uuid);
      const deleted_at = new Date();

      await tx.tbl_outlet_karyawan.updateMany({
        where: {
          uuid_karyawan: {
            in: deleted_karyawan_uuids,
          },
          deleted_at: null,
        },
        data: {
          deleted_at,
        },
      });

      await tx.tbl_karyawan.updateMany({
        where: {
          uuid: {
            in: deleted_karyawan_uuids,
          },
          deleted_at: null,
        },
        data: {
          deleted_at,
        },
      });
    }
  });

  return {
    success: true,
    data: {
      data_karyawan: unique_karyawan,
    },
    summary: {
      inserted_karyawan: new_karyawan.length,
      updated_karyawan: update_karyawan.length,
      skipped_karyawan: skipped_karyawan.length,
      deleted_karyawan: deleted_karyawan.length,
      retained_skipped_karyawan: skipped_deleted_karyawan.length,
    },
  };
}

export async function getKaryawan() {
  return {
    data_karyawan: await getKaryawanSettingsData(),
  };
}

export async function updateKaryawan({
  uuid_karyawan,
  name,
  username,
  password,
  outlet_placements = [],
  outlet_uuids = [],
  is_skip_sync_karyawan,
  is_skip_sync_outlet_karyawan,
}) {
  if (!uuid_karyawan) {
    throw new Error("UUID karyawan wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const normalized_outlet_placements = Array.isArray(outlet_placements)
    ? outlet_placements.map((placement) => ({
        uuid: String(placement?.uuid ?? "").trim(),
        outlet_uuid: String(placement?.outlet_uuid ?? "").trim(),
      }))
    : [];
  const fallback_outlet_uuids = Array.from(
    new Set(
      Array.isArray(outlet_uuids)
        ? outlet_uuids.map((item) => String(item).trim()).filter(Boolean)
        : [],
    ),
  );
  const resolved_outlet_placements = normalized_outlet_placements.length
    ? normalized_outlet_placements.filter((placement) => placement.outlet_uuid)
    : fallback_outlet_uuids.map((outlet_uuid) => ({
        uuid: "",
        outlet_uuid,
      }));
  const placement_uuid_list = resolved_outlet_placements
    .map((placement) => placement.uuid)
    .filter(Boolean);
  const unique_outlet_uuids = Array.from(
    new Set(
      resolved_outlet_placements
        .map((placement) => placement.outlet_uuid)
        .filter(Boolean),
    ),
  );

  if (!trimmed_name) {
    throw new Error("Nama karyawan wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username karyawan wajib diisi.");
  }

  if (trimmed_password && trimmed_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  if (placement_uuid_list.length !== new Set(placement_uuid_list).size) {
    throw new Error("Data penempatan outlet duplikat tidak valid.");
  }

  if (unique_outlet_uuids.length !== resolved_outlet_placements.length) {
    throw new Error("Outlet yang sama tidak boleh dipilih lebih dari satu kali.");
  }

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
    await tx.tbl_karyawan.update({
      where: { uuid: uuid_karyawan },
      data: {
        name: trimmed_name,
        username: trimmed_username,
        ...(trimmed_password
          ? {
              password: trimmed_password,
              is_password_change: false,
            }
          : {}),
        is_skip_sync: Boolean(is_skip_sync_karyawan),
      },
    });

    const current_relations = await tx.tbl_outlet_karyawan.findMany({
      where: {
        uuid_karyawan,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        deleted_at: true,
      },
    });
    const active_relations = current_relations.filter((item) => item.deleted_at === null);
    const current_relation_uuid_set = new Set(
      active_relations.map((item) => item.uuid),
    );
    const requested_relation_uuid_set = new Set(placement_uuid_list);

    if (
      placement_uuid_list.some(
        (placement_uuid) => !current_relation_uuid_set.has(placement_uuid),
      )
    ) {
      throw new Error("Sebagian penempatan outlet tidak ditemukan untuk karyawan ini.");
    }

    const current_relations_by_uuid = new Map(
      current_relations.map((item) => [item.uuid, item]),
    );
    const current_relations_by_outlet_uuid = new Map(
      current_relations.map((item) => [item.uuid_outlet, item]),
    );
    const relation_uuids_to_remove = active_relations
      .filter((item) => !requested_relation_uuid_set.has(item.uuid))
      .map((item) => item.uuid);

    if (relation_uuids_to_remove.length > 0) {
      await tx.tbl_outlet_karyawan.updateMany({
        where: {
          uuid: {
            in: relation_uuids_to_remove,
          },
        },
        data: {
          deleted_at: new Date(),
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

    for (const placement of resolved_outlet_placements) {
      if (placement.uuid) {
        const current_relation = current_relations_by_uuid.get(placement.uuid);

        if (!current_relation) {
          continue;
        }

        if (current_relation.uuid_outlet === placement.outlet_uuid) {
          await tx.tbl_outlet_karyawan.update({
            where: {
              uuid: placement.uuid,
            },
            data: {
              deleted_at: null,
              is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
            },
          });
          continue;
        }

        const existing_target_relation = current_relations_by_outlet_uuid.get(
          placement.outlet_uuid,
        );

        if (existing_target_relation && existing_target_relation.uuid !== placement.uuid) {
          await tx.tbl_outlet_karyawan.update({
            where: {
              uuid: existing_target_relation.uuid,
            },
            data: {
              deleted_at: null,
              is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
            },
          });

          await tx.tbl_outlet_karyawan.update({
            where: {
              uuid: placement.uuid,
            },
            data: {
              deleted_at: new Date(),
            },
          });

          continue;
        }

        await tx.tbl_outlet_karyawan.update({
          where: {
            uuid: placement.uuid,
          },
          data: {
            uuid_outlet: placement.outlet_uuid,
            deleted_at: null,
            is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
          },
        });
        continue;
      }

      const existing_target_relation = current_relations_by_outlet_uuid.get(
        placement.outlet_uuid,
      );

      if (existing_target_relation) {
        await tx.tbl_outlet_karyawan.update({
          where: {
            uuid: existing_target_relation.uuid,
          },
          data: {
            deleted_at: null,
            is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
          },
        });
        continue;
      }

      await tx.tbl_outlet_karyawan.create({
        data: {
          uuid: randomUUID(),
          uuid_outlet: placement.outlet_uuid,
          uuid_karyawan,
          is_skip_sync: Boolean(is_skip_sync_outlet_karyawan),
        },
      });
    }
  });

  const refreshed_data = await getKaryawan();
  const updated_karyawan = refreshed_data.data_karyawan.find(
    (item) => item.uuid === uuid_karyawan,
  );

  return {
    success: true,
    data: updated_karyawan ?? null,
    message: "Data karyawan berhasil diperbarui.",
  };
}
