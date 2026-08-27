import { prisma } from "@/lib/prisma";
import { dedupeByUuid } from "@/lib/utils";

export async function fetchOutletPayload() {
  const url = process.env.OUTLET_SLIP_GAJI_API_URL;

  if (!url) {
    throw new Error("Environment variable OUTLET_SLIP_GAJI_API_URL belum diatur.");
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan OUTLET_SLIP_GAJI_API_URL: ${result.status}`);
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error("Response OUTLET_SLIP_GAJI_API_URL harus berupa array data outlet.");
  }

  return payload;
}

export function normalizeOutletKategori(raw_kategori) {
  const kategori_array = ["non_pariwisata", "pariwisata", "parsial"]
  const normalized_kategori = String(raw_kategori ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")

  console.log(normalized_kategori)

  const resolved_kategori = kategori_array.includes(normalized_kategori);

  if (!resolved_kategori) {
    throw new Error(`Kategori outlet tidak valid: ${raw_kategori ?? "-"}.`);
  }

  return normalized_kategori;
}

export function normalizeOutletRows(outlet_payload) {
  const data_outlet = outlet_payload
    .map((item) => {
      const uuid = String(item?.id ?? "").trim();
      const name = String(item?.nama ?? "").trim();
      const kategori = normalizeOutletKategori(item?.kategori_cabang);

      if (!uuid || !name) {
        return null;
      }

      return {
        uuid,
        name,
        kategori,
      };
    })
    .filter(Boolean);

  if (!data_outlet.length) {
    throw new Error("Data outlet dari API kosong.");
  }

  return dedupeByUuid(data_outlet);
}

export async function getOutletSettingsData() {
  const data_outlet = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
      kategori: true,
      is_skip_sync: true,
      outlet_karyawan: {
        where: {
          deleted_at: null,
          karyawan: {
            deleted_at: null,
          },
        },
        select: {
          karyawan: {
            select: { uuid: true, name: true },
          },
        },
      },
    },
  });

  return data_outlet.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    kategori: item.kategori,
    is_skip_sync: Boolean(item.is_skip_sync),
    karyawan_uuids:
      item.outlet_karyawan.length > 0
        ? item.outlet_karyawan.map((outlet_karyawan) => outlet_karyawan.karyawan.uuid)
        : [],
    karyawan_names:
      item.outlet_karyawan.length > 0
        ? item.outlet_karyawan.map((outlet_karyawan) => outlet_karyawan.karyawan.name)
        : [],
  }));
}

export async function syncOutlet() {
  const outlet_payload = await fetchOutletPayload();
  const unique_outlet = normalizeOutletRows(outlet_payload);
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
            kategori: item.kategori,
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
  return {
    data_outlet: await getOutletSettingsData(),
  };
}

export async function updateOutlet({
  uuid_outlet,
  name,
  kategori,
  is_skip_sync,
}) {
  if (!uuid_outlet) {
    throw new Error("UUID outlet wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_kategori = normalizeOutletKategori(kategori);

  if (!trimmed_name) {
    throw new Error("Nama outlet wajib diisi.");
  }

  const existing_outlet = await prisma.tbl_outlet.findUnique({
    where: { uuid: uuid_outlet },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_outlet || existing_outlet.deleted_at) {
    throw new Error("Data outlet tidak ditemukan.");
  }
  await prisma.tbl_outlet.update({
    where: { uuid: uuid_outlet },
    data: {
      name: trimmed_name,
      kategori: trimmed_kategori,
      is_skip_sync: Boolean(is_skip_sync),
    },
  });

  const refreshed_data = await getOutlet();
  const updated_outlet = refreshed_data.data_outlet.find(
    (item) => item.uuid === uuid_outlet,
  );

  return {
    success: true,
    data: updated_outlet ?? null,
    message: "Data outlet berhasil diperbarui.",
  };
}
