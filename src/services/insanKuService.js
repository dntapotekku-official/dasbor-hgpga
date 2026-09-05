import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { randomUUID } from "node:crypto";
import { dedupeByUuid } from "@/lib/utils";

export async function fetchInsanKuPayload() {
  const url =
    process.env.INSANKU_SLIP_GAJI_API_URL ??
    process.env.INSANKU_SLIPGAJI_API_URL ??
    process.env.KARYAWAN_SLIP_GAJI_API_URL ??
    process.env.KARYAWAN_SLIPGAJI_API_URL;

  if (!url) {
    throw new Error("Environment variable INSANKU_SLIP_GAJI_API_URL belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan INSANKU_SLIP_GAJI_API_URL: ${result.status}`);
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error("Response INSANKU_SLIP_GAJI_API_URL harus berupa array data InsanKu.");
  }

  return payload;
}

export function normalizeInsanKuRows(insanku_payload) {
  const data_insanku = insanku_payload
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

  return dedupeByUuid(data_insanku);
}

export async function getInsanKuSettingsData() {
  const data_insanku = await prisma.tbl_insanku.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      is_skip_sync: true,
      outlet_insanku: {
        where: {
          deleted_at: null,
          outlet: {
            deleted_at: null,
            excep: false,
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

  return data_insanku.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    username: item.username,
    is_skip_sync_insanku: Boolean(item.is_skip_sync),
    is_skip_sync_outlet_insanku: item.outlet_insanku.some(
      (outlet_insanku) => outlet_insanku.is_skip_sync,
    ),
    outlet_uuids:
      item.outlet_insanku.length > 0
        ? item.outlet_insanku.map((outlet_insanku) => outlet_insanku.outlet.uuid)
        : [],
    outlet_names:
      item.outlet_insanku.length > 0
        ? item.outlet_insanku.map((outlet_insanku) => outlet_insanku.outlet.name)
        : [],
    outlet_placements:
      item.outlet_insanku.length > 0
        ? item.outlet_insanku.map((outlet_insanku) => ({
            uuid: outlet_insanku.uuid,
            outlet_uuid: outlet_insanku.outlet.uuid,
            outlet_name: outlet_insanku.outlet.name,
          }))
        : [],
  }));
}

export async function syncInsanKu() {
  const insanku_payload = await fetchInsanKuPayload();
  const unique_insanku = normalizeInsanKuRows(insanku_payload);
  const incoming_insanku_uuid_set = new Set(
    unique_insanku.map((item) => item.uuid),
  );
  const existing_insanku = await prisma.tbl_insanku.findMany({
    select: {
      uuid: true,
      username: true,
      password: true,
      is_skip_sync: true,
      deleted_at: true,
    },
  });
  const existing_insanku_map = new Map(
    existing_insanku.map((item) => [item.uuid, item]),
  );
  const new_insanku = await Promise.all(
    unique_insanku
      .filter((item) => !existing_insanku_map.has(item.uuid))
      .map(async (item) => ({
        ...item,
        password: await hashPassword(item.password),
      })),
  );
  const update_insanku = unique_insanku
    .filter((item) => existing_insanku_map.has(item.uuid))
    .filter((item) => !existing_insanku_map.get(item.uuid)?.is_skip_sync)
    .map((item) => {
      const existing_item = existing_insanku_map.get(item.uuid);

      return {
        ...item,
        username:
          existing_item?.username && existing_item.username !== item.username
            ? existing_item.username
            : item.username,
        password: existing_item?.password ?? item.password,
      };
    });
  const skipped_insanku = unique_insanku.filter(
    (item) => existing_insanku_map.get(item.uuid)?.is_skip_sync,
  );
  const deleted_insanku = existing_insanku.filter(
    (item) =>
      !incoming_insanku_uuid_set.has(item.uuid) &&
      !item.is_skip_sync &&
      item.deleted_at === null,
  );
  const skipped_deleted_insanku = existing_insanku.filter(
    (item) =>
      !incoming_insanku_uuid_set.has(item.uuid) &&
      item.is_skip_sync &&
      item.deleted_at === null,
  );

  await prisma.$transaction(async (tx) => {
    if (new_insanku.length > 0) {
      await tx.tbl_insanku.createMany({
        data: new_insanku,
        skipDuplicates: true,
      });
    }

    await Promise.all(
      update_insanku.map((item) =>
        tx.tbl_insanku.update({
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

    if (deleted_insanku.length > 0) {
      const deleted_insanku_uuids = deleted_insanku.map((item) => item.uuid);
      const deleted_at = new Date();
      const deleted_outlet_insanku = await tx.tbl_outlet_insanku.findMany({
        where: {
          uuid_insanku: {
            in: deleted_insanku_uuids,
          },
          deleted_at: null,
        },
        select: {
          uuid: true,
        },
      });
      const deleted_outlet_insanku_uuids = deleted_outlet_insanku.map(
        (item) => item.uuid,
      );

      if (deleted_outlet_insanku_uuids.length > 0) {
        await tx.tbl_penjualan_gofitku.updateMany({
          where: {
            uuid_outlet_insanku: {
              in: deleted_outlet_insanku_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        });
      }

      await tx.tbl_atribut_insanku.updateMany({
        where: {
          uuid_insanku: {
            in: deleted_insanku_uuids,
          },
          deleted_at: null,
        },
        data: {
          deleted_at,
        },
      });

      await tx.tbl_outlet_insanku.updateMany({
        where: {
          uuid_insanku: {
            in: deleted_insanku_uuids,
          },
          deleted_at: null,
        },
        data: {
          deleted_at,
        },
      });

      await tx.tbl_insanku.updateMany({
        where: {
          uuid: {
            in: deleted_insanku_uuids,
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
      data_insanku: unique_insanku,
    },
    summary: {
      inserted_insanku: new_insanku.length,
      updated_insanku: update_insanku.length,
      skipped_insanku: skipped_insanku.length,
      deleted_insanku: deleted_insanku.length,
      retained_skipped_insanku: skipped_deleted_insanku.length,
    },
  };
}

export async function getInsanKu() {
  return {
    data_insanku: await getInsanKuSettingsData(),
  };
}

export async function updateInsanKu({
  uuid_insanku,
  name,
  username,
  password,
  outlet_placements = [],
  outlet_uuids = [],
  is_skip_sync_insanku,
  is_skip_sync_outlet_insanku,
}) {
  if (!uuid_insanku) {
    throw new Error("UUID InsanKu wajib diisi.");
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
    throw new Error("Nama InsanKu wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username InsanKu wajib diisi.");
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
    const hashed_password = trimmed_password
      ? await hashPassword(trimmed_password)
      : null;

    await tx.tbl_insanku.update({
      where: { uuid: uuid_insanku },
      data: {
        name: trimmed_name,
        username: trimmed_username,
        ...(trimmed_password
          ? {
              password: hashed_password,
              is_password_change: false,
            }
          : {}),
        is_skip_sync: Boolean(is_skip_sync_insanku),
      },
    });

    const current_relations = await tx.tbl_outlet_insanku.findMany({
      where: {
        uuid_insanku,
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
      throw new Error("Sebagian penempatan outlet tidak ditemukan untuk InsanKu ini.");
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
      await tx.tbl_outlet_insanku.updateMany({
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

    await tx.tbl_outlet_insanku.updateMany({
      where: {
        uuid_insanku,
        deleted_at: null,
      },
      data: {
        is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
      },
    });

    for (const placement of resolved_outlet_placements) {
      if (placement.uuid) {
        const current_relation = current_relations_by_uuid.get(placement.uuid);

        if (!current_relation) {
          continue;
        }

        if (current_relation.uuid_outlet === placement.outlet_uuid) {
          await tx.tbl_outlet_insanku.update({
            where: {
              uuid: placement.uuid,
            },
            data: {
              deleted_at: null,
              is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
            },
          });
          continue;
        }

        const existing_target_relation = current_relations_by_outlet_uuid.get(
          placement.outlet_uuid,
        );

        if (existing_target_relation && existing_target_relation.uuid !== placement.uuid) {
          await tx.tbl_outlet_insanku.update({
            where: {
              uuid: existing_target_relation.uuid,
            },
            data: {
              deleted_at: null,
              is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
            },
          });

          await tx.tbl_outlet_insanku.update({
            where: {
              uuid: placement.uuid,
            },
            data: {
              deleted_at: new Date(),
            },
          });

          continue;
        }

        await tx.tbl_outlet_insanku.update({
          where: {
            uuid: placement.uuid,
          },
          data: {
            uuid_outlet: placement.outlet_uuid,
            deleted_at: null,
            is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
          },
        });
        continue;
      }

      const existing_target_relation = current_relations_by_outlet_uuid.get(
        placement.outlet_uuid,
      );

      if (existing_target_relation) {
        await tx.tbl_outlet_insanku.update({
          where: {
            uuid: existing_target_relation.uuid,
          },
          data: {
            deleted_at: null,
            is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
          },
        });
        continue;
      }

      await tx.tbl_outlet_insanku.create({
        data: {
          uuid: randomUUID(),
          uuid_outlet: placement.outlet_uuid,
          uuid_insanku,
          is_skip_sync: Boolean(is_skip_sync_outlet_insanku),
        },
      });
    }
  });

  const refreshed_data = await getInsanKu();
  const updated_insanku = refreshed_data.data_insanku.find(
    (item) => item.uuid === uuid_insanku,
  );

  return {
    success: true,
    data: updated_insanku ?? null,
    message: "Data InsanKu berhasil diperbarui.",
  };
}
