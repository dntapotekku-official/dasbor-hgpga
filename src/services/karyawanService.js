import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import {
  fetch_karyawan_payload,
  get_pengaturan_data,
  normalize_karyawan_rows,
} from "@/services/pengaturanSharedService";

export async function syncKaryawan() {
  const karyawan_payload = await fetch_karyawan_payload();
  const unique_karyawan = normalize_karyawan_rows(karyawan_payload);
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
            username: item.username,
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
  const data = await get_pengaturan_data();

  return {
    data_karyawan: data.data_karyawan,
  };
}

export async function updateKaryawan({
  uuid_karyawan,
  name,
  username,
  outlet_uuids = [],
  is_skip_sync_karyawan,
  is_skip_sync_outlet_karyawan,
}) {
  if (!uuid_karyawan) {
    throw new Error("UUID karyawan wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const unique_outlet_uuids = Array.from(
    new Set(
      Array.isArray(outlet_uuids)
        ? outlet_uuids.map((item) => String(item).trim()).filter(Boolean)
        : [],
    ),
  );

  if (!trimmed_name) {
    throw new Error("Nama karyawan wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username karyawan wajib diisi.");
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
        is_skip_sync: Boolean(is_skip_sync_karyawan),
      },
    });

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
      (uuid_outlet) => !valid_outlet_uuid_set.has(uuid_outlet),
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
