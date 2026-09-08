import { prisma } from "@/lib/prisma";
import { dedupeByUuid } from "@/lib/utils";

export async function fetchOutletPayload() {
  const url = process.env.OUTLET_SLIP_GAJI_API_URL;
  const api_key = process.env.APOTEKKU_API_KEY;

  if (!url) {
    throw new Error("Environment variable OUTLET_SLIP_GAJI_API_URL belum diatur.");
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
    throw new Error(`Gagal menyinkronkan OUTLET_SLIP_GAJI_API_URL: ${result.status}`);
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error("Response OUTLET_SLIP_GAJI_API_URL harus berupa array data outlet.");
  }

  return payload;
}

function normalizeOutletKategori(raw_kategori) {
  const kategori_array = ["non_pariwisata", "pariwisata", "parsial"];
  const normalized_kategori = String(raw_kategori ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

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
      const category = normalizeOutletKategori(item?.kategori_cabang);

      if (!uuid || !name) {
        return null;
      }

      return {
        uuid,
        name,
        category,
      };
    })
    .filter(Boolean);

  if (!data_outlet.length) {
    throw new Error("Data outlet dari API kosong.");
  }

  return dedupeByUuid(data_outlet);
}

async function getOutletSettingsData({
  include_excluded = false,
} = {}) {
  const data_outlet = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      ...(include_excluded ? {} : { excep: false }),
    },
    select: {
      uuid: true,
      name: true,
      category: true,
      excep: true,
      is_skip_sync: true,
      outlet_insanku: {
        where: {
          deleted_at: null,
          insanku: {
            deleted_at: null,
          },
        },
        select: {
          insanku: {
            select: { uuid: true, name: true },
          },
        },
      },
    },
  });

  return data_outlet.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    kategori: item.category,
    excep: Boolean(item.excep),
    is_skip_sync: Boolean(item.is_skip_sync),
    insanku_uuids:
      item.outlet_insanku.length > 0
        ? item.outlet_insanku.map((outlet_insanku) => outlet_insanku.insanku.uuid)
        : [],
    insanku_names:
      item.outlet_insanku.length > 0
        ? item.outlet_insanku.map((outlet_insanku) => outlet_insanku.insanku.name)
        : [],
  }));
}

export async function syncOutlet() {
  const outlet_payload = await fetchOutletPayload();
  const unique_outlet = normalizeOutletRows(outlet_payload);
  const incoming_outlet_uuid_set = new Set(unique_outlet.map((item) => item.uuid));
  const existing_outlet = await prisma.tbl_outlet.findMany({
    select: {
      uuid: true,
      is_skip_sync: true,
      deleted_at: true,
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
  const skipped_outlet = unique_outlet.filter(
    (item) => existing_outlet_map.get(item.uuid)?.is_skip_sync,
  );
  const deleted_outlet = existing_outlet.filter(
    (item) =>
      !incoming_outlet_uuid_set.has(item.uuid) &&
      !item.is_skip_sync &&
      item.deleted_at === null,
  );
  const skipped_deleted_outlet = existing_outlet.filter(
    (item) =>
      !incoming_outlet_uuid_set.has(item.uuid) &&
      item.is_skip_sync &&
      item.deleted_at === null,
  );

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
            category: item.category,
            deleted_at: null,
          },
        }),
      ),
    );

    if (deleted_outlet.length > 0) {
      const deleted_outlet_uuids = deleted_outlet.map((item) => item.uuid);
      const deleted_at = new Date();
      const deleted_outlet_insanku = await tx.tbl_outlet_insanku.findMany({
        where: {
          uuid_outlet: {
            in: deleted_outlet_uuids,
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

      await Promise.all([
        tx.tbl_outlet_insanku.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_kepatuhan_sop_cctv.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_target_gofitku.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_target_nilai_transaksi.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_target_basket_size.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_nilai_transaksi.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_basket_size.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_dilayani.updateMany({
          where: {
            uuid_outlet: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
        tx.tbl_outlet.updateMany({
          where: {
            uuid: {
              in: deleted_outlet_uuids,
            },
            deleted_at: null,
          },
          data: {
            deleted_at,
          },
        }),
      ]);
    }
  });

  return {
    success: true,
    data: {
      data_outlet: unique_outlet,
    },
    summary: {
      inserted_outlet: new_outlet.length,
      updated_outlet: update_outlet.length,
      skipped_outlet: skipped_outlet.length,
      deleted_outlet: deleted_outlet.length,
      retained_skipped_outlet: skipped_deleted_outlet.length,
    },
  };
}

export async function getOutlet(options) {
  return {
    data_outlet: await getOutletSettingsData(options),
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
      category: trimmed_kategori,
      is_skip_sync: Boolean(is_skip_sync),
    },
  });

  const refreshed_data = await getOutlet({ include_excluded: true });
  const updated_outlet = refreshed_data.data_outlet.find(
    (item) => item.uuid === uuid_outlet,
  );

  return {
    success: true,
    data: updated_outlet ?? null,
    message: "Data outlet berhasil diperbarui.",
  };
}

export async function updateOutletException({
  uuid_outlet,
  excep,
}) {
  if (!uuid_outlet) {
    throw new Error("UUID outlet wajib diisi.");
  }

  const existing_outlet = await prisma.tbl_outlet.findFirst({
    where: {
      uuid: uuid_outlet,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (!existing_outlet) {
    throw new Error("Data outlet tidak ditemukan.");
  }

  await prisma.tbl_outlet.update({
    where: {
      uuid: uuid_outlet,
    },
    data: {
      excep: Boolean(excep),
    },
  });

  const refreshed_data = await getOutlet({ include_excluded: true });
  const updated_outlet = refreshed_data.data_outlet.find(
    (item) => item.uuid === uuid_outlet,
  );

  return {
    success: true,
    data: updated_outlet ?? null,
    message: Boolean(excep)
      ? "Outlet berhasil dikecualikan dari sistem."
      : "Outlet berhasil diaktifkan kembali.",
  };
}
