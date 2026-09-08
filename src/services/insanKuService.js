import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { randomUUID } from "node:crypto";
import { dedupeByUuid } from "@/lib/utils";
import { normalizeNik, stripInvisibleCharacters } from "@/lib/nik";
import { softDeleteInsanKuRelations } from "@/services/softDeleteInsanKuRelations";

function normalizeOutletPlacements(outlet_placements, outlet_uuids) {
  const normalized_placements = Array.isArray(outlet_placements)
    ? outlet_placements
        .map((placement) => ({
          uuid: String(placement?.uuid ?? "").trim(),
          outlet_uuid: String(placement?.outlet_uuid ?? "").trim(),
        }))
        .filter((placement) => placement.outlet_uuid)
    : [];
  const resolved_placements = normalized_placements.length
    ? normalized_placements
    : Array.isArray(outlet_uuids)
      ? outlet_uuids
          .map((outlet_uuid) => ({
            uuid: "",
            outlet_uuid: String(outlet_uuid ?? "").trim(),
          }))
          .filter((placement) => placement.outlet_uuid)
      : [];
  const placement_uuids = resolved_placements
    .map((placement) => placement.uuid)
    .filter(Boolean);
  const unique_outlet_uuids = Array.from(
    new Set(resolved_placements.map((placement) => placement.outlet_uuid)),
  );

  if (placement_uuids.length !== new Set(placement_uuids).size) {
    throw new Error("Data penempatan outlet duplikat tidak valid.");
  }

  if (unique_outlet_uuids.length !== resolved_placements.length) {
    throw new Error("Outlet yang sama tidak boleh dipilih lebih dari satu kali.");
  }

  return {
    placements: resolved_placements,
    placement_uuids,
    outlet_uuids: unique_outlet_uuids,
  };
}

async function validateOutlets(database, outlet_uuids) {
  if (outlet_uuids.length === 0) {
    return;
  }

  const valid_outlets = await database.tbl_outlet.findMany({
    where: {
      uuid: { in: outlet_uuids },
      deleted_at: null,
      excep: false,
    },
    select: { uuid: true },
  });

  if (valid_outlets.length !== outlet_uuids.length) {
    throw new Error("Sebagian outlet yang dipilih tidak ditemukan.");
  }
}

export async function fetchInsanKuPayload() {
  const url = process.env.KARYAWAN_SLIP_GAJI_API_URL;
  const api_key = process.env.APOTEKKU_API_KEY;

  if (!url) {
    throw new Error("Environment variable KARYAWAN_SLIP_GAJI_API_URL belum diatur.");
  }

  if (!api_key) {
    throw new Error("Environment variable APOTEKKU_API_KEY belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": api_key,
    },
  });

  if (!result.ok) {
    throw new Error(
      `Gagal menyinkronkan KARYAWAN_SLIP_GAJI_API_URL: ${result.status}`,
    );
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error(
      "Response KARYAWAN_SLIP_GAJI_API_URL harus berupa array data InsanKu.",
    );
  }

  return payload;
}

export function normalizeInsanKuRows(insanku_payload) {
  const data_insanku = insanku_payload
    .map((item) => {
      const uuid = String(
        item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
      ).trim();
      const base_username = stripInvisibleCharacters(
        item?.username ?? item?.nip ?? item?.nik ?? "",
      )
        .trim()
        .replace(/@apotekku$/i, "");

      if (!uuid) {
        return null;
      }

      return {
        uuid,
        nik:
          normalizeNik(
            item?.nik ??
              item?.nik_karyawan ??
              item?.nomor_induk_karyawan ??
              item?.nomor_induk ??
              "",
          ) || null,
        name: String(item?.nama ?? item?.name ?? "-").trim() || "-",
        username: base_username ? `${base_username}@apotekku` : `${uuid}@apotekku`,
        password: item?.password ?? "apotekku",
        is_username_change: false,
        is_password_change: false,
        avatar: item?.foto_profile ?? item?.avatar ?? null,
        is_slip_gaji_account: true,
        role: "member",
      };
    })
    .filter(Boolean);

  return dedupeByUuid(data_insanku);
}

export async function getInsanKuSettingsData(is_slip_gaji_account = true) {
  const data_insanku = await prisma.tbl_insanku.findMany({
    where: {
      deleted_at: null,
      is_slip_gaji_account,
    },
    select: {
      uuid: true,
      nik: true,
      name: true,
      username: true,
      is_slip_gaji_account: true,
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
    nik: item.nik,
    name: item.name,
    username: item.username,
    is_slip_gaji_account: item.is_slip_gaji_account,
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
    where: {
      is_slip_gaji_account: true,
    },
    select: {
      uuid: true,
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
        username: item.username,
        nik: item.nik,
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

  const inserted_insanku = await prisma.$transaction(async (tx) => {
    let inserted_count = 0;

    if (new_insanku.length > 0) {
      const result = await tx.tbl_insanku.createMany({
        data: new_insanku,
        skipDuplicates: true,
      });
      inserted_count = result.count;
    }

    await Promise.all(
      update_insanku.map((item) =>
        tx.tbl_insanku.update({
          where: { uuid: item.uuid },
          data: {
            name: item.name,
            username: item.username,
            nik: item.nik,
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
      await softDeleteInsanKuRelations(tx, deleted_insanku_uuids, deleted_at);

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

    return inserted_count;
  });

  return {
    success: true,
    data: {
      data_insanku: unique_insanku,
    },
    summary: {
      inserted_insanku,
      skipped_duplicate_insanku: new_insanku.length - inserted_insanku,
      updated_insanku: update_insanku.length,
      skipped_insanku: skipped_insanku.length,
      deleted_insanku: deleted_insanku.length,
      retained_skipped_insanku: skipped_deleted_insanku.length,
    },
  };
}

export async function getInsanKu() {
  return {
    data_insanku: await getInsanKuSettingsData(true),
  };
}

export async function updateInsanKu({
  uuid_insanku,
  nik,
  name,
  username,
  password,
  outlet_placements = [],
  outlet_uuids = [],
  is_skip_sync_insanku,
  is_skip_sync_outlet_insanku,
  expected_is_slip_gaji_account = true,
}) {
  if (!uuid_insanku) {
    throw new Error("UUID InsanKu wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_nik = normalizeNik(nik);
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const normalized_placements = normalizeOutletPlacements(
    outlet_placements,
    outlet_uuids,
  );
  const resolved_outlet_placements = normalized_placements.placements;
  const placement_uuid_list = normalized_placements.placement_uuids;
  const unique_outlet_uuids = normalized_placements.outlet_uuids;

  if (!trimmed_name) {
    throw new Error("Nama InsanKu wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username InsanKu wajib diisi.");
  }

  if (trimmed_password && trimmed_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  if (Boolean(is_skip_sync_outlet_insanku) && unique_outlet_uuids.length === 0) {
    throw new Error("Lewati sinkron penempatan hanya bisa dipakai jika InsanKu punya outlet.");
  }

  const existing_insanku = await prisma.tbl_insanku.findUnique({
    where: { uuid: uuid_insanku },
    select: {
      uuid: true,
      is_slip_gaji_account: true,
      deleted_at: true,
    },
  });

  if (
    !existing_insanku ||
    existing_insanku.deleted_at ||
    existing_insanku.is_slip_gaji_account !== expected_is_slip_gaji_account
  ) {
    throw new Error("Data InsanKu tidak ditemukan.");
  }

  await validateOutlets(prisma, unique_outlet_uuids);

  const hashed_password = trimmed_password
    ? await hashPassword(trimmed_password)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.tbl_insanku.update({
      where: { uuid: uuid_insanku },
      data: {
        name: trimmed_name,
        username: trimmed_username,
        ...(nik !== undefined ? { nik: trimmed_nik || null } : {}),
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

  const refreshed_data = {
    data_insanku: await getInsanKuSettingsData(expected_is_slip_gaji_account),
  };
  const updated_insanku = refreshed_data.data_insanku.find(
    (item) => item.uuid === uuid_insanku,
  );

  return {
    success: true,
    data: updated_insanku ?? null,
    message: "Data InsanKu berhasil diperbarui.",
  };
}

export async function getInsanKuNonSlipGaji() {
  return {
    data_insanku: await getInsanKuSettingsData(false),
  };
}

export async function createInsanKuNonSlipGaji({
  nik,
  name,
  username,
  password,
  outlet_placements = [],
  outlet_uuids = [],
}) {
  const trimmed_nik = normalizeNik(nik);
  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const normalized_placements = normalizeOutletPlacements(
    outlet_placements,
    outlet_uuids,
  );

  if (!trimmed_name || !trimmed_username || !trimmed_password) {
    throw new Error("Nama, username, dan password wajib diisi.");
  }

  if (trimmed_password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  await validateOutlets(prisma, normalized_placements.outlet_uuids);

  const hashed_password = await hashPassword(trimmed_password);
  const created_insanku = await prisma.$transaction(async (transaction) => {
    const insanku = await transaction.tbl_insanku.create({
      data: {
        uuid: randomUUID(),
        nik: trimmed_nik || null,
        name: trimmed_name,
        username: trimmed_username,
        password: hashed_password,
        is_slip_gaji_account: false,
        role: "member",
      },
    });

    if (normalized_placements.outlet_uuids.length > 0) {
      await transaction.tbl_outlet_insanku.createMany({
        data: normalized_placements.outlet_uuids.map((uuid_outlet) => ({
          uuid: randomUUID(),
          uuid_outlet,
          uuid_insanku: insanku.uuid,
        })),
      });
    }

    return insanku;
  });

  const refreshed_data = await getInsanKuNonSlipGaji();

  return {
    success: true,
    data: refreshed_data.data_insanku.find(
      (item) => item.uuid === created_insanku.uuid,
    ),
    message: "Data InsanKu Non Slip Gaji berhasil ditambahkan.",
  };
}

export async function updateInsanKuNonSlipGaji(payload) {
  return updateInsanKu({
    ...payload,
    expected_is_slip_gaji_account: false,
  });
}

export async function deleteInsanKuNonSlipGaji(uuid_insanku) {
  const existing_insanku = await prisma.tbl_insanku.findFirst({
    where: {
      uuid: uuid_insanku,
      is_slip_gaji_account: false,
      deleted_at: null,
    },
    select: { uuid: true },
  });

  if (!existing_insanku) {
    throw new Error("Data InsanKu Non Slip Gaji tidak ditemukan.");
  }

  await prisma.$transaction(async (transaction) => {
    const deleted_at = new Date();
    await softDeleteInsanKuRelations(transaction, [uuid_insanku], deleted_at);
    await transaction.tbl_insanku.update({
      where: { uuid: uuid_insanku },
      data: { deleted_at },
    });
  });

  return {
    success: true,
    message: "Data InsanKu Non Slip Gaji berhasil dihapus.",
  };
}
