import { prisma } from "@/lib/prisma";
import {
  fetch_outlet_payload,
  get_pengaturan_data,
  normalize_outlet_rows,
} from "@/services/pengaturanSharedService";

export async function syncOutlet() {
  const outlet_payload = await fetch_outlet_payload();
  const unique_outlet = normalize_outlet_rows(outlet_payload);
  const existing_outlet = await prisma.tbl_outlet.findMany({
    select: {
      uuid: true,
      is_skip_sync: true,
    },
  });
  const existing_outlet_map = new Map(
    existing_outlet.map((item) => [item.uuid, item]),
  );
  const new_outlet = unique_outlet.filter(
    (item) => !existing_outlet_map.has(item.uuid),
  );
  const update_outlet = unique_outlet.filter((item) => {
    const current_outlet = existing_outlet_map.get(item.uuid);
    return current_outlet && !current_outlet.is_skip_sync;
  });

  await prisma.$transaction(async (tx) => {
    if (new_outlet.length > 0) {
      await tx.tbl_outlet.createMany({
        data: new_outlet,
        skipDuplicates: true,
      });
    }

    await Promise.all(
      update_outlet.map((item) =>
        tx.tbl_outlet.update({
          where: { uuid: item.uuid },
          data: {
            name: item.name,
            deleted_at: null,
          },
        }),
      ),
    );
  });

  return {
    success: true,
    data: {
      data_outlet: unique_outlet,
    },
    summary: {
      inserted_outlet: new_outlet.length,
      updated_outlet: update_outlet.length,
    },
  };
}

export async function getOutlet() {
  const data = await get_pengaturan_data();

  return {
    data_outlet: data.data_outlet,
  };
}

export async function updateOutlet({
  uuid_outlet,
  name,
  is_skip_sync
}) {
  if (!uuid_outlet) {
    throw new Error("UUID outlet wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();

  if (!trimmed_name) {
    throw new Error("Nama outlet wajib diisi.");
  }
  const updated_outlet = await prisma.tbl_outlet.update({
    where: { uuid: uuid_outlet },
    data: {
      name: trimmed_name,
      is_skip_sync: Boolean(is_skip_sync)
    },
    select: {
      uuid: true,
      name: true,
    },
  });

  return {
    success: true,
    data: updated_outlet,
    message: "Data outlet berhasil diperbarui.",
  };
}
