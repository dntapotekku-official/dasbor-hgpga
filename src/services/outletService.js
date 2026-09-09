import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { dedupeByUuid } from "@/lib/utils";

const DEFAULT_OUTLET_PASSWORD = "apotekku";

function getDefaultOutletUsername(uuid) {
  return `outlet-${uuid}`;
}

function normalizeOutletMatchName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

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
  member_outlet_uuid,
} = {}) {
  const data_outlet = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      ...(member_outlet_uuid ? { uuid: member_outlet_uuid } : {}),
      ...(include_excluded ? {} : { excep: false }),
    },
    select: {
      uuid: true,
      name: true,
      category: true,
      excep: true,
      is_skip_sync: true,
      username: true,
      is_username_change: true,
      is_password_change: true,
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
    username: item.username,
    is_username_change: Boolean(item.is_username_change),
    is_password_change: Boolean(item.is_password_change),
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
  const default_password = new_outlet.length
    ? await hashPassword(DEFAULT_OUTLET_PASSWORD)
    : null;
  const new_outlet_accounts = new_outlet.map((item) => ({
    ...item,
    username: getDefaultOutletUsername(item.uuid),
    password: default_password,
  }));

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
    if (new_outlet_accounts.length > 0) {
      await tx.tbl_outlet.createMany({
        data: new_outlet_accounts,
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
  username,
  password,
}) {
  if (!uuid_outlet) {
    throw new Error("UUID outlet wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_kategori = normalizeOutletKategori(kategori);
  const trimmed_username = String(username ?? "").trim();
  const normalized_password = String(password ?? "");

  if (!trimmed_name) {
    throw new Error("Nama outlet wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username outlet wajib diisi.");
  }

  if (trimmed_username.length > 100) {
    throw new Error("Username outlet maksimal 100 karakter.");
  }

  if (normalized_password && normalized_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  const existing_outlet = await prisma.tbl_outlet.findUnique({
    where: { uuid: uuid_outlet },
    select: {
      uuid: true,
      username: true,
      is_username_change: true,
      deleted_at: true,
    },
  });

  if (!existing_outlet || existing_outlet.deleted_at) {
    throw new Error("Data outlet tidak ditemukan.");
  }


  const [duplicate_username, duplicate_admin_username] = await Promise.all([
    prisma.tbl_outlet.findFirst({
      where: {
        username: trimmed_username,
        uuid: { not: uuid_outlet },
      },
      select: { uuid: true },
    }),
    prisma.tbl_admin.findUnique({
      where: { username: trimmed_username },
      select: { uuid: true },
    }),
  ]);

  if (duplicate_username || duplicate_admin_username) {
    throw new Error("Username sudah digunakan oleh akun lain.");
  }

  const hashed_password = normalized_password
    ? await hashPassword(normalized_password)
    : null;

  await prisma.tbl_outlet.update({
    where: { uuid: uuid_outlet },
    data: {
      name: trimmed_name,
      category: trimmed_kategori,
      is_skip_sync: Boolean(is_skip_sync),
      username: trimmed_username,
      is_username_change:
        existing_outlet.is_username_change ||
        existing_outlet.username !== trimmed_username,
      ...(hashed_password
        ? {
            password: hashed_password,
            is_password_change: true,
          }
        : {}),
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

export async function importOutletCredentials({ rows = [] }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("File Excel tidak memiliki data akun outlet.");
  }

  if (rows.length > 5000) {
    throw new Error("Maksimal 5.000 akun outlet dapat diimpor sekaligus.");
  }

  const normalized_rows = rows.map((row) => ({
    outlet_name: String(row?.outlet_name ?? "").trim(),
    username: String(row?.username ?? "").trim(),
    password: String(row?.password ?? ""),
  }));

  const invalid_row = normalized_rows.find(
    (row) => !row.outlet_name || !row.username || !row.password,
  );

  if (invalid_row) {
    throw new Error("Outlet, Username, dan Password wajib diisi pada setiap baris.");
  }

  if (normalized_rows.some((row) => row.username.length > 100)) {
    throw new Error("Username outlet maksimal 100 karakter.");
  }

  if (normalized_rows.some((row) => row.password.length < 6)) {
    throw new Error("Password outlet minimal 6 karakter.");
  }

  const outlet_names = normalized_rows.map((row) =>
    normalizeOutletMatchName(row.outlet_name),
  );
  const usernames = normalized_rows.map((row) => row.username);

  if (new Set(outlet_names).size !== outlet_names.length) {
    throw new Error("File Excel memiliki nama Outlet yang duplikat.");
  }

  if (new Set(usernames.map((username) => username.toLowerCase())).size !== usernames.length) {
    throw new Error("File Excel memiliki Username yang duplikat.");
  }

  const [outlets, conflicting_outlets, conflicting_admins] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: { deleted_at: null },
      select: { uuid: true, name: true },
    }),
    prisma.tbl_outlet.findMany({
      where: {
        username: { in: usernames },
      },
      select: { uuid: true, username: true },
    }),
    prisma.tbl_admin.findMany({
      where: { username: { in: usernames } },
      select: { username: true },
    }),
  ]);

  const outlets_by_name = new Map();
  const duplicate_master_names = new Set();

  outlets.forEach((outlet) => {
    const normalized_name = normalizeOutletMatchName(outlet.name);

    if (outlets_by_name.has(normalized_name)) {
      duplicate_master_names.add(normalized_name);
    } else {
      outlets_by_name.set(normalized_name, outlet);
    }
  });

  const ambiguous_outlet_names = outlet_names.filter((name) =>
    duplicate_master_names.has(name),
  );

  if (ambiguous_outlet_names.length) {
    throw new Error(
      `${ambiguous_outlet_names.length} nama Outlet terdaftar lebih dari sekali pada master outlet.`,
    );
  }

  const missing_outlet_names = outlet_names.filter(
    (name) => !outlets_by_name.has(name),
  );

  if (missing_outlet_names.length) {
    throw new Error(
      `${missing_outlet_names.length} nama Outlet pada file tidak ditemukan di master outlet.`,
    );
  }

  const has_conflicting_outlet = conflicting_outlets.some((outlet) => {
    const imported_row = normalized_rows.find(
      (row) => row.username.toLowerCase() === outlet.username.toLowerCase(),
    );

    const matched_outlet = imported_row
      ? outlets_by_name.get(normalizeOutletMatchName(imported_row.outlet_name))
      : null;

    return matched_outlet?.uuid !== outlet.uuid;
  });

  if (has_conflicting_outlet || conflicting_admins.length) {
    throw new Error("Sebagian username sudah digunakan oleh akun lain.");
  }

  const prepared_rows = await Promise.all(
    normalized_rows.map(async (row) => ({
      ...row,
      uuid: outlets_by_name.get(normalizeOutletMatchName(row.outlet_name)).uuid,
      password: await hashPassword(row.password),
    })),
  );

  await prisma.$transaction(
    prepared_rows.map((row) =>
      prisma.tbl_outlet.update({
        where: { uuid: row.uuid },
        data: {
          username: row.username,
          password: row.password,
          is_username_change: true,
          is_password_change: true,
        },
      }),
    ),
  );

  return {
    success: true,
    message: `Username dan password berhasil diimpor untuk ${prepared_rows.length} outlet.`,
    data: {
      imported_count: prepared_rows.length,
    },
  };
}
