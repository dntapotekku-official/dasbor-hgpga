import { prisma } from "@/lib/prisma";

export function dedupe_by_uuid(items) {
  return Array.from(
    new Map(items.map((item) => [item.uuid, item])).values(),
  );
}

export function dedupe_outlet_karyawan(items) {
  return Array.from(
    new Map(
      items.map((item) => [`${item.uuid_outlet}:${item.uuid_karyawan}`, item]),
    ).values(),
  );
}

export function build_relation_key({ uuid_outlet, uuid_karyawan }) {
  return `${uuid_outlet}:${uuid_karyawan}`;
}

export async function fetch_slip_gaji_payload(url, label) {
  if (!url) {
    throw new Error(`Environment variable ${label} belum diatur.`);
  }

  const result = await fetch(url, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan ${label}: ${result.status}`);
  }

  const response = await result.json();

  return response.data ?? response;
}

export async function fetch_outlet_payload() {
  const outlet_payload = await fetch_slip_gaji_payload(
    process.env.OUTLET_SLIP_GAJI_API_URL,
    "OUTLET_SLIP_GAJI_API_URL",
  );

  if (!Array.isArray(outlet_payload)) {
    throw new Error("Response OUTLET_SLIP_GAJI_API_URL harus berupa array data outlet.");
  }

  return outlet_payload;
}

export async function fetch_karyawan_payload() {
  const karyawan_payload = await fetch_slip_gaji_payload(
    process.env.KARYAWAN_SLIP_GAJI_API_URL ??
      process.env.KARYAWAN_SLIPGAJI_API_URL,
    "KARYAWAN_SLIP_GAJI_API_URL",
  );

  if (!Array.isArray(karyawan_payload)) {
    throw new Error("Response KARYAWAN_SLIP_GAJI_API_URL harus berupa array data karyawan.");
  }

  return karyawan_payload;
}

export async function fetch_outlet_karyawan_payload() {
  return fetch_slip_gaji_payload(
    process.env.OUTLET_KARYAWAN_SLIP_GAJI_API_URL ??
      process.env.OUTLET_KARYAWAN_SLIPGAJI_API_URL,
    "OUTLET_KARYAWAN_SLIP_GAJI_API_URL",
  );
}

export function normalize_outlet_rows(outlet_payload) {
  const data_outlet = outlet_payload
    .map((item) => {
      const uuid = String(item?.id ?? "").trim();
      const name = String(item?.nama ?? "").trim();

      if (!uuid || !name) {
        return null;
      }

      return {
        uuid,
        name,
      };
    })
    .filter(Boolean);

  if (!data_outlet.length) {
    throw new Error("Data outlet dari API kosong.");
  }

  return dedupe_by_uuid(data_outlet);
}

export function normalize_karyawan_rows(karyawan_payload) {
  const data_karyawan = karyawan_payload
    .map((item) => {
      const uuid = String(
        item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
      ).trim();
      const username = String(
        item?.username ?? item?.nip ?? item?.nik ?? "",
      ).trim();

      if (!uuid) {
        return null;
      }

      return {
        uuid,
        name: String(item?.nama ?? item?.name ?? "-").trim() || "-",
        username: username || `user_${uuid}`,
        password: item?.password ?? "apotekku",
        is_username_change: false,
        is_password_change: false,
        avatar: item?.foto_profile ?? item?.avatar ?? null,
        role: "member",
      };
    })
    .filter(Boolean);

  return dedupe_by_uuid(data_karyawan);
}

export function normalize_outlet_karyawan_rows({
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
    unique_rows: dedupe_outlet_karyawan(valid_rows),
  };
}

export async function get_pengaturan_data() {
  const [data_outlet, data_karyawan, data_admin] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: {
        deleted_at: null,
      },
    }),
    prisma.tbl_karyawan.findMany({
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
          select: {
            is_skip_sync: true,
            outlet: {
              select: { uuid: true, name: true },
            },
          },
        },
      },
    }),
    prisma.tbl_admin.findMany({
      where: {
        deleted_at: null,
      },
      select: {
        uuid: true,
        name: true,
        username: true,
        role: true,
      },
    }),
  ]);

  return {
    data_outlet,
    data_karyawan: data_karyawan.map((item) => ({
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
    })),
    data_admin: data_admin.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      username: item.username,
      role: item.role,
    })),
  };
}
