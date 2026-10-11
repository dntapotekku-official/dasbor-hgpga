import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { randomUUID } from "node:crypto";
import { dedupeByUuid } from "@/lib/utils";
import { normalizeNik, stripInvisibleCharacters } from "@/lib/nik";
import { buildSlipGajiApiUrl } from "@/lib/slipGajiApi";
import {
  closeInsanKuInactivePeriod,
  closeOutletInsanKuInactivePeriod,
  createOutletInsanKuPreActivePeriod,
  openInsanKuInactivePeriod,
  openOutletInsanKuInactivePeriod,
} from "@/services/inactivePeriodService";
import { softDeleteInsanKuRelations } from "@/services/softDeleteInsanKuRelations";

const DEFAULT_INSANKU_PASSWORD = "Apotekku";

function parseOptionalDate(value, field_label) {
  const normalized_value = String(value ?? "").trim();

  if (!normalized_value) {
    return null;
  }

  const date = new Date(`${normalized_value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field_label} tidak valid.`);
  }

  return date;
}

function formatDateInput(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function normalizeOutletPlacements(outlet_placements, outlet_uuids) {
  const has_outlet_placements_input = Array.isArray(outlet_placements);
  const normalized_placements = has_outlet_placements_input
    ? outlet_placements
        .map((placement) => ({
          uuid: String(placement?.uuid ?? "").trim(),
          outlet_uuid: String(placement?.outlet_uuid ?? "").trim(),
          active_start_date: String(placement?.active_start_date ?? "").trim(),
          uuid_jabatan_master: String(
            placement?.uuid_jabatan_master ?? "",
          ).trim(),
          jabatan_is_active: Boolean(placement?.jabatan_is_active ?? true),
        }))
        .filter((placement) => placement.outlet_uuid)
    : [];
  const resolved_placements = has_outlet_placements_input
    ? normalized_placements
    : Array.isArray(outlet_uuids)
      ? outlet_uuids
          .map((outlet_uuid) => ({
            uuid: "",
            outlet_uuid: String(outlet_uuid ?? "").trim(),
            active_start_date: "",
            uuid_jabatan_master: "",
            jabatan_is_active: true,
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

function normalizeDeletedOutletPlacements(deleted_outlet_placements) {
  return Array.isArray(deleted_outlet_placements)
    ? deleted_outlet_placements
        .map((placement) => ({
          uuid: String(placement?.uuid ?? "").trim(),
          outlet_uuid: String(placement?.outlet_uuid ?? "").trim(),
          inactive_start_date: String(placement?.inactive_start_date ?? "").trim(),
        }))
        .filter((placement) => placement.uuid)
    : [];
}

function getInsanKuPayloadUuid(item) {
  return String(
    item?.id_karyawans ?? item?.id_karyawan ?? item?.uuid ?? item?.id ?? "",
  ).trim();
}

function normalizeUsernameKey(username) {
  return String(username ?? "").trim().toLowerCase();
}

function buildDefaultInsanKuUsername(item, uuid) {
  const base_username = stripInvisibleCharacters(
    item?.username ?? item?.nip ?? item?.nik ?? "",
  )
    .trim()
    .replace(/@apotekku$/i, "")
    .replace(/@[^@]+$/i, "");

  return base_username ? `${base_username}@apotekku` : `${uuid}@apotekku`;
}

async function validateOutlets(database, outlet_uuids) {
  if (outlet_uuids.length === 0) {
    return;
  }

  const valid_outlets = await database.tbl_outlet.findMany({
    where: {
      uuid: { in: outlet_uuids },
      deleted_at: null,
      is_active: true,
      excep: false,
    },
    select: { uuid: true },
  });

  if (valid_outlets.length !== outlet_uuids.length) {
    throw new Error("Sebagian outlet yang dipilih tidak ditemukan.");
  }
}

async function validateJabatanMaster(database, jabatan_uuids) {
  const unique_jabatan_uuids = Array.from(
    new Set(jabatan_uuids.filter(Boolean)),
  );

  if (unique_jabatan_uuids.length === 0) {
    return;
  }

  const valid_jabatan = await database.tbl_jabatan_master.findMany({
    where: {
      uuid: { in: unique_jabatan_uuids },
      deleted_at: null,
    },
    select: { uuid: true },
  });

  if (valid_jabatan.length !== unique_jabatan_uuids.length) {
    throw new Error("Sebagian jabatan yang dipilih tidak ditemukan.");
  }
}

async function savePlacementJabatan(database, placement, uuid_outlet_insanku) {
  if (!placement.uuid_jabatan_master) {
    await database.tbl_jabatan_insanku.updateMany({
      where: { uuid_outlet_insanku },
      data: {
        uuid_jabatan_master: null,
        is_active: placement.jabatan_is_active,
        deleted_at: null,
      },
    });
    return;
  }

  await database.tbl_jabatan_insanku.upsert({
    where: { uuid_outlet_insanku },
    update: {
      uuid_jabatan_master: placement.uuid_jabatan_master,
      is_active: placement.jabatan_is_active,
      deleted_at: null,
    },
    create: {
      uuid: randomUUID(),
      uuid_outlet_insanku,
      uuid_jabatan_master: placement.uuid_jabatan_master,
      is_active: placement.jabatan_is_active,
    },
  });
}

async function getJabatanMasterData() {
  return prisma.tbl_jabatan_master.findMany({
    where: { deleted_at: null },
    orderBy: { name: "asc" },
    select: {
      uuid: true,
      name: true,
    },
  });
}

export async function fetchInsanKuPayload() {
  const url = buildSlipGajiApiUrl({
    legacy_env_name: "KARYAWAN_SLIP_GAJI_API_URL",
    path_env_name: "KARYAWAN_SLIP_GAJI_API_PATH_URL",
    fallback_path: "karyawan",
  });
  const api_key = process.env.APOTEKKU_API_KEY;

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
      `Gagal menyinkronkan data karyawan Slip Gaji: ${result.status}`,
    );
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error(
      "Response data karyawan Slip Gaji harus berupa array data InsanKu.",
    );
  }

  return payload;
}

export async function fetchOutletInsanKuPayload() {
  const url = buildSlipGajiApiUrl({
    legacy_env_name: "OUTLET_KARYAWAN_SLIPGAJI_API_URL",
    path_env_name: "OUTLET_KARYAWAN_SLIPGAJI_API_PATH_URL",
    fallback_path: "cabang_karyawan",
  });
  const api_key = process.env.APOTEKKU_API_KEY;

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
      `Gagal menyinkronkan data cabang-karyawan Slip Gaji: ${result.status}`,
    );
  }

  const response = await result.json();

  return response.data ?? response;
}

export async function fetchJabatanPayload() {
  const url = buildSlipGajiApiUrl({
    legacy_env_name: "JABATAN_SLIP_GAJI_API_URL",
    path_env_name: "JABATAN_SLIP_GAJI_API_PATH_URL",
    fallback_path: "jabatan",
  });
  const api_key = process.env.APOTEKKU_API_KEY;

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
      `Gagal menyinkronkan data jabatan Slip Gaji: ${result.status}`,
    );
  }

  const response = await result.json();
  const payload = response.data ?? response;

  if (!Array.isArray(payload)) {
    throw new Error("Response data jabatan Slip Gaji harus berupa array data jabatan.");
  }

  return payload;
}

export async function fetchJabatanInsanKuPayload() {
  const url = buildSlipGajiApiUrl({
    legacy_env_name: "JABATAN_KARYAWAN_SLIP_GAJI_API_URL",
    path_env_name: "JABATAN_KARYAWAN_SLIP_GAJI_API_PATH_URL",
    fallback_path: "jb-karyawan",
  });
  const api_key = process.env.APOTEKKU_API_KEY;

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
      `Gagal menyinkronkan data jabatan-karyawan Slip Gaji: ${result.status}`,
    );
  }

  const response = await result.json();

  return response.data ?? response;
}

export function normalizeOutletInsanKuUsernames(outlet_insanku_payload) {
  const username_map = new Map();
  const outlet_insanku_lists = Array.isArray(outlet_insanku_payload)
    ? [outlet_insanku_payload]
    : Object.values(outlet_insanku_payload ?? {});

  outlet_insanku_lists.forEach((insanku_list) => {
    if (!Array.isArray(insanku_list)) {
      return;
    }

    insanku_list.forEach((item) => {
      const uuid = getInsanKuPayloadUuid(item);
      const username = stripInvisibleCharacters(item?.username ?? "").trim();

      if (!uuid || !username || username_map.has(uuid)) {
        return;
      }

      username_map.set(uuid, username);
    });
  });

  return username_map;
}

export function normalizeInsanKuRows(insanku_payload, username_map = new Map()) {
  const data_insanku = insanku_payload
    .map((item) => {
      const uuid = getInsanKuPayloadUuid(item);

      if (!uuid) {
        return null;
      }

      const username = username_map.get(uuid);

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
        username: username || buildDefaultInsanKuUsername(item, uuid),
        password: DEFAULT_INSANKU_PASSWORD,
        is_username_change: false,
        is_password_change: false,
        avatar: item?.foto_profile ?? item?.avatar ?? null,
        is_active: true,
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
      is_active: true,
      is_slip_gaji_account: true,
      is_skip_sync: true,
      gofitku_exclusion_periods: {
        where: {
          deleted_at: null,
          OR: [
            { end_date: null },
            { end_date: { gte: new Date() } },
          ],
        },
        orderBy: {
          start_date: "desc",
        },
        take: 1,
        select: {
          uuid: true,
          start_date: true,
          end_date: true,
        },
      },
      outlet_insanku: {
        where: {
          deleted_at: null,
          is_active: true,
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
          is_active: true,
          is_skip_sync: true,
          outlet: {
            select: { uuid: true, name: true },
          },
          jabatan_insanku: {
            where: {
              deleted_at: null,
            },
            orderBy: {
              updated_at: "desc",
            },
            take: 1,
            select: {
              uuid: true,
              is_active: true,
              jabatan_master: {
                select: {
                  uuid: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return data_insanku.map((item) => {
    const active_gofitku_exclusion = item.gofitku_exclusion_periods[0] ?? null;

    return {
      uuid: item.uuid,
      nik: item.nik,
      name: item.name,
      username: item.username,
      is_active: Boolean(item.is_active),
      is_slip_gaji_account: item.is_slip_gaji_account,
      is_skip_sync_insanku: Boolean(item.is_skip_sync),
      is_skip_sync_outlet_insanku: item.outlet_insanku.some(
        (outlet_insanku) => outlet_insanku.is_skip_sync,
      ),
      is_exclude_penjualan_gofitku: Boolean(active_gofitku_exclusion),
      gofitku_exclusion_start_date: formatDateInput(
        active_gofitku_exclusion?.start_date,
      ),
      gofitku_exclusion_end_date: formatDateInput(
        active_gofitku_exclusion?.end_date,
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
          ? item.outlet_insanku.map((outlet_insanku) => {
              const jabatan_insanku = outlet_insanku.jabatan_insanku[0] ?? null;

              return {
                uuid: outlet_insanku.uuid,
                outlet_uuid: outlet_insanku.outlet.uuid,
                outlet_name: outlet_insanku.outlet.name,
                is_active: Boolean(outlet_insanku.is_active),
                uuid_jabatan_master: jabatan_insanku?.jabatan_master?.uuid ?? "",
                jabatan_name: jabatan_insanku?.jabatan_master?.name ?? "",
                jabatan_is_active: Boolean(jabatan_insanku?.is_active),
              };
            })
          : [],
    };
  });
}

export async function syncInsanKu() {
  const [insanku_payload, outlet_insanku_payload] = await Promise.all([
    fetchInsanKuPayload(),
    fetchOutletInsanKuPayload(),
  ]);
  const username_map = normalizeOutletInsanKuUsernames(outlet_insanku_payload);
  const unique_insanku = normalizeInsanKuRows(insanku_payload, username_map);
  const incoming_insanku_uuid_set = new Set(
    unique_insanku.map((item) => item.uuid),
  );
  const [existing_insanku, existing_username_rows] = await Promise.all([
    prisma.tbl_insanku.findMany({
      where: {
        is_slip_gaji_account: true,
      },
      select: {
        uuid: true,
        password: true,
        username: true,
        is_password_change: true,
        is_skip_sync: true,
        is_active: true,
        deleted_at: true,
      },
    }),
    prisma.tbl_insanku.findMany({
      select: {
        uuid: true,
        username: true,
      },
    }),
  ]);
  const existing_insanku_map = new Map(
    existing_insanku.map((item) => [item.uuid, item]),
  );
  const reserved_username_owner_map = new Map(
    existing_username_rows
      .map((item) => [normalizeUsernameKey(item.username), item.uuid])
      .filter(([username]) => username),
  );
  let username_conflict_insanku = 0;
  const reserveUsername = (username, owner_uuid) => {
    const username_key = normalizeUsernameKey(username);
    const username_owner_uuid = reserved_username_owner_map.get(username_key);

    if (username_owner_uuid && username_owner_uuid !== owner_uuid) {
      username_conflict_insanku += 1;
      return null;
    }

    if (username_key) {
      reserved_username_owner_map.set(username_key, owner_uuid);
    }

    return username;
  };
  const reserveFallbackUsername = (item) => {
    let attempt = 0;

    while (attempt < 100) {
      const username =
        attempt === 0
          ? `${item.uuid}@apotekku`
          : `${item.uuid}-${attempt}@apotekku`;
      const reserved_username = reserveUsername(username, item.uuid);

      if (reserved_username) {
        return reserved_username;
      }

      attempt += 1;
    }

    throw new Error("Gagal membuat username fallback unik untuk InsanKu.");
  };
  const resolveNewUsername = (item) => {
    return reserveUsername(item.username, item.uuid) ?? reserveFallbackUsername(item);
  };
  const resolveUpdateUsername = (item) => {
    const existing_item = existing_insanku_map.get(item.uuid);

    return reserveUsername(item.username, item.uuid) ?? existing_item?.username;
  };
  const default_password = await hashPassword(DEFAULT_INSANKU_PASSWORD);
  const new_insanku = unique_insanku
    .filter((item) => !existing_insanku_map.has(item.uuid))
    .map((item) => ({
      ...item,
      username: resolveNewUsername(item),
      password: default_password,
    }));
  const update_insanku = unique_insanku
    .filter((item) => existing_insanku_map.has(item.uuid))
    .filter((item) => {
      const existing_item = existing_insanku_map.get(item.uuid);
      return !existing_item.is_skip_sync || existing_item.deleted_at !== null;
    })
    .map((item) => {
      const existing_item = existing_insanku_map.get(item.uuid);
      const is_reactivated = existing_item.deleted_at !== null;
      const resolved_password =
        !is_reactivated && existing_item.is_password_change
          ? existing_item.password ?? default_password
          : default_password;

      return {
        ...item,
        username: resolveUpdateUsername(item),
        nik: item.nik,
        password: resolved_password,
        is_reactivated,
      };
    });
  const skipped_insanku = unique_insanku.filter(
    (item) => {
      const existing_item = existing_insanku_map.get(item.uuid);
      return existing_item?.is_skip_sync && existing_item.deleted_at === null;
    },
  );
  const inactive_insanku = existing_insanku.filter(
    (item) =>
      !incoming_insanku_uuid_set.has(item.uuid) &&
      item.is_active &&
      item.deleted_at === null,
  );
  const reactivated_insanku_uuids = update_insanku
    .filter((item) => item.is_reactivated)
    .map((item) => item.uuid);
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
      update_insanku.map(async (item) => {
        await tx.tbl_insanku.update({
          where: { uuid: item.uuid },
          data: {
            name: item.name,
            username: item.username,
            nik: item.nik,
            password: item.password,
            avatar: item.avatar,
            role: item.role,
            is_active: true,
            ...(item.is_reactivated
              ? {
                  is_username_change: false,
                  is_password_change: false,
                  is_skip_sync: false,
                }
              : {}),
            deleted_at: null,
          },
        });
        await closeInsanKuInactivePeriod(tx, item.uuid);
      }),
    );

    const skipped_active_insanku_uuids = skipped_insanku
      .map((item) => item.uuid)
      .filter(Boolean);

    if (skipped_active_insanku_uuids.length > 0) {
      await tx.tbl_insanku.updateMany({
        where: {
          uuid: {
            in: skipped_active_insanku_uuids,
          },
          deleted_at: null,
        },
        data: {
          is_active: true,
        },
      });
      await Promise.all(
        skipped_active_insanku_uuids.map((uuid_insanku) =>
          closeInsanKuInactivePeriod(tx, uuid_insanku),
        ),
      );
    }

    if (inactive_insanku.length > 0) {
      const inactive_start_date = new Date();

      await tx.tbl_insanku.updateMany({
        where: {
          uuid: {
            in: inactive_insanku.map((item) => item.uuid),
          },
          deleted_at: null,
        },
        data: {
          is_active: false,
        },
      });
      await Promise.all(
        inactive_insanku.map((item) =>
          openInsanKuInactivePeriod(tx, item.uuid, inactive_start_date),
        ),
      );
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
      username_conflict_insanku,
      updated_insanku: update_insanku.length,
      reactivated_insanku: reactivated_insanku_uuids.length,
      skipped_insanku: skipped_insanku.length,
      inactive_insanku: inactive_insanku.length,
      deleted_insanku: 0,
      retained_skipped_insanku: 0,
    },
  };
}

export async function getInsanKu() {
  const [data_insanku, data_jabatan] = await Promise.all([
    getInsanKuSettingsData(true),
    getJabatanMasterData(),
  ]);

  return {
    data_insanku,
    data_jabatan,
  };
}

export async function updateInsanKu({
  uuid_insanku,
  nik,
  name,
  username,
  password,
  is_active,
  outlet_placements = [],
  deleted_outlet_placements = [],
  outlet_uuids = [],
  is_skip_sync_insanku,
  is_skip_sync_outlet_insanku,
  is_exclude_penjualan_gofitku,
  gofitku_exclusion_start_date,
  gofitku_exclusion_end_date,
  expected_is_slip_gaji_account = true,
}) {
  if (!uuid_insanku) {
    throw new Error("UUID InsanKu wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_nik = normalizeNik(nik);
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const normalized_is_active =
    typeof is_active === "string"
      ? is_active.toLowerCase() !== "false"
      : Boolean(is_active ?? true);
  const normalized_placements = normalizeOutletPlacements(
    outlet_placements,
    outlet_uuids,
  );
  const normalized_deleted_placements = normalizeDeletedOutletPlacements(
    deleted_outlet_placements,
  );
  const resolved_outlet_placements = normalized_placements.placements;
  const deleted_placement_date_map = new Map(
    normalized_deleted_placements.map((placement) => [
      placement.uuid,
      parseOptionalDate(
        placement.inactive_start_date,
        "Tanggal efektif hapus penempatan",
      ) ?? new Date(),
    ]),
  );
  const placement_uuid_list = normalized_placements.placement_uuids;
  const unique_outlet_uuids = normalized_placements.outlet_uuids;

  if (!trimmed_name) {
    throw new Error("Nama InsanKu wajib diisi.");
  }

  if (!expected_is_slip_gaji_account && !trimmed_nik) {
    throw new Error("NIK InsanKu Non Slip Gaji wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username InsanKu wajib diisi.");
  }

  if (trimmed_password && trimmed_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  const should_skip_sync_outlet_insanku =
    Boolean(is_skip_sync_outlet_insanku) && unique_outlet_uuids.length > 0;
  const should_exclude_penjualan_gofitku =
    Boolean(is_exclude_penjualan_gofitku);
  const exclusion_start_date = parseOptionalDate(
    gofitku_exclusion_start_date,
    "Tanggal mulai pengecualian GoFitKu",
  );
  const exclusion_end_date = parseOptionalDate(
    gofitku_exclusion_end_date,
    "Tanggal selesai pengecualian GoFitKu",
  );

  if (should_exclude_penjualan_gofitku && !exclusion_start_date) {
    throw new Error("Tanggal mulai pengecualian GoFitKu wajib diisi.");
  }

  if (
    should_exclude_penjualan_gofitku &&
    exclusion_end_date &&
    exclusion_end_date < exclusion_start_date
  ) {
    throw new Error("Tanggal selesai pengecualian GoFitKu tidak boleh sebelum tanggal mulai.");
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
  await validateJabatanMaster(
    prisma,
    resolved_outlet_placements.map(
      (placement) => placement.uuid_jabatan_master,
    ),
  );

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
        is_active: normalized_is_active,
        is_skip_sync: Boolean(is_skip_sync_insanku),
      },
    });
    if (normalized_is_active) {
      await closeInsanKuInactivePeriod(tx, uuid_insanku);
    } else {
      await openInsanKuInactivePeriod(tx, uuid_insanku);
    }

    const now = new Date();
    const today_start = new Date(now.toISOString().slice(0, 10));
    const current_exclusions = await tx.tbl_insanku_gofitku_exclusion.findMany({
      where: {
        uuid_insanku,
        deleted_at: null,
        OR: [{ end_date: null }, { end_date: { gte: now } }],
      },
      select: { uuid: true, start_date: true, end_date: true },
    });
    const exclusion_unchanged = should_exclude_penjualan_gofitku &&
      current_exclusions.length === 1 &&
      current_exclusions[0].start_date.getTime() === exclusion_start_date.getTime() &&
      current_exclusions[0].end_date?.getTime() === exclusion_end_date?.getTime();

    if (!exclusion_unchanged) {
      const yesterday_end = new Date(today_start.getTime() - 1);
      await tx.tbl_insanku_gofitku_exclusion.updateMany({
        where: {
          uuid_insanku,
          deleted_at: null,
          start_date: { lt: today_start },
          OR: [{ end_date: null }, { end_date: { gte: now } }],
        },
        data: { end_date: yesterday_end },
      });
      await tx.tbl_insanku_gofitku_exclusion.updateMany({
        where: {
          uuid_insanku,
          deleted_at: null,
          start_date: { gte: today_start },
        },
        data: { deleted_at: now },
      });

      if (should_exclude_penjualan_gofitku) {
        await tx.tbl_insanku_gofitku_exclusion.create({
          data: {
            uuid: randomUUID(),
            uuid_insanku,
            start_date: exclusion_start_date,
            end_date: exclusion_end_date,
          },
        });
      }
    }

    const current_relations = await tx.tbl_outlet_insanku.findMany({
      where: {
        uuid_insanku,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        is_active: true,
        deleted_at: true,
      },
    });
    const active_relations = current_relations.filter(
      (item) => item.deleted_at === null && item.is_active,
    );
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
      const inactive_start_date = new Date();

      await tx.tbl_outlet_insanku.updateMany({
        where: {
          uuid: {
            in: relation_uuids_to_remove,
          },
        },
        data: {
          is_active: false,
        },
      });
      await tx.tbl_jabatan_insanku.updateMany({
        where: {
          uuid_outlet_insanku: {
            in: relation_uuids_to_remove,
          },
          deleted_at: null,
        },
        data: {
          is_active: false,
        },
      });
      await Promise.all(
        relation_uuids_to_remove.map((uuid_outlet_insanku) =>
          openOutletInsanKuInactivePeriod(
            tx,
            uuid_outlet_insanku,
            deleted_placement_date_map.get(uuid_outlet_insanku) ??
              inactive_start_date,
          ),
        ),
      );
    }

    await tx.tbl_outlet_insanku.updateMany({
      where: {
        uuid_insanku,
        deleted_at: null,
      },
      data: {
        is_skip_sync: should_skip_sync_outlet_insanku,
      },
    });

    for (const placement of resolved_outlet_placements) {
      const placement_active_start_date = parseOptionalDate(
        placement.active_start_date,
        "Tanggal mulai penempatan",
      );

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
              is_active: true,
              is_skip_sync: should_skip_sync_outlet_insanku,
            },
          });
          await closeOutletInsanKuInactivePeriod(
            tx,
            placement.uuid,
            placement_active_start_date ?? undefined,
          );
          await savePlacementJabatan(tx, placement, placement.uuid);
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
              is_active: true,
              is_skip_sync: should_skip_sync_outlet_insanku,
            },
          });
          await closeOutletInsanKuInactivePeriod(
            tx,
            existing_target_relation.uuid,
            placement_active_start_date ?? undefined,
          );
          await savePlacementJabatan(
            tx,
            placement,
            existing_target_relation.uuid,
          );

          await tx.tbl_outlet_insanku.update({
            where: {
              uuid: placement.uuid,
            },
            data: {
              is_active: false,
            },
          });
          await tx.tbl_jabatan_insanku.updateMany({
            where: {
              uuid_outlet_insanku: placement.uuid,
              deleted_at: null,
            },
            data: { is_active: false },
          });
          await openOutletInsanKuInactivePeriod(
            tx,
            placement.uuid,
            placement_active_start_date ?? undefined,
          );

          continue;
        }

        const sale_count = await tx.tbl_penjualan_gofitku.count({
          where: { uuid_outlet_insanku: placement.uuid },
        });

        if (sale_count > 0) {
          await tx.tbl_outlet_insanku.update({
            where: { uuid: placement.uuid },
            data: { is_active: false },
          });
          await tx.tbl_jabatan_insanku.updateMany({
            where: {
              uuid_outlet_insanku: placement.uuid,
              deleted_at: null,
            },
            data: { is_active: false },
          });
          await openOutletInsanKuInactivePeriod(
            tx,
            placement.uuid,
            placement_active_start_date ?? undefined,
          );
          const created_relation_uuid = randomUUID();

          await tx.tbl_outlet_insanku.create({
            data: {
              uuid: created_relation_uuid,
              uuid_outlet: placement.outlet_uuid,
              uuid_insanku,
              is_active: true,
              is_skip_sync: should_skip_sync_outlet_insanku,
            },
          });
          await createOutletInsanKuPreActivePeriod(
            tx,
            created_relation_uuid,
            placement_active_start_date,
          );
          await savePlacementJabatan(tx, placement, created_relation_uuid);
        } else {
          await tx.tbl_outlet_insanku.update({
            where: { uuid: placement.uuid },
            data: {
              uuid_outlet: placement.outlet_uuid,
              deleted_at: null,
              is_active: true,
              is_skip_sync: should_skip_sync_outlet_insanku,
            },
          });
          await closeOutletInsanKuInactivePeriod(
            tx,
            placement.uuid,
            placement_active_start_date ?? undefined,
          );
          await savePlacementJabatan(tx, placement, placement.uuid);
        }
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
            is_active: true,
            is_skip_sync: should_skip_sync_outlet_insanku,
          },
        });
        await closeOutletInsanKuInactivePeriod(
          tx,
          existing_target_relation.uuid,
          placement_active_start_date ?? undefined,
        );
        await savePlacementJabatan(
          tx,
          placement,
          existing_target_relation.uuid,
        );
        continue;
      }

      const created_relation_uuid = randomUUID();

      await tx.tbl_outlet_insanku.create({
        data: {
          uuid: created_relation_uuid,
          uuid_outlet: placement.outlet_uuid,
          uuid_insanku,
          is_active: true,
          is_skip_sync: should_skip_sync_outlet_insanku,
        },
      });
      await createOutletInsanKuPreActivePeriod(
        tx,
        created_relation_uuid,
        placement_active_start_date,
      );
      await savePlacementJabatan(tx, placement, created_relation_uuid);
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
  const [data_insanku, data_jabatan] = await Promise.all([
    getInsanKuSettingsData(false),
    getJabatanMasterData(),
  ]);

  return {
    data_insanku,
    data_jabatan,
  };
}

export async function createInsanKuNonSlipGaji({
  nik,
  name,
  username,
  outlet_placements = [],
  outlet_uuids = [],
}) {
  const trimmed_nik = normalizeNik(nik);
  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const normalized_placements = normalizeOutletPlacements(
    outlet_placements,
    outlet_uuids,
  );

  if (!trimmed_nik || !trimmed_name || !trimmed_username) {
    throw new Error("NIK, nama, dan username wajib diisi.");
  }

  await validateOutlets(prisma, normalized_placements.outlet_uuids);
  await validateJabatanMaster(
    prisma,
    normalized_placements.placements.map(
      (placement) => placement.uuid_jabatan_master,
    ),
  );

  const created_insanku = await prisma.$transaction(async (transaction) => {
    const insanku = await transaction.tbl_insanku.create({
      data: {
        uuid: randomUUID(),
        nik: trimmed_nik,
        name: trimmed_name,
        username: trimmed_username,
        password: null,
        is_slip_gaji_account: false,
        role: "member",
      },
    });

    for (const placement of normalized_placements.placements) {
      const uuid_outlet_insanku = randomUUID();

      await transaction.tbl_outlet_insanku.create({
        data: {
          uuid: uuid_outlet_insanku,
          uuid_outlet: placement.outlet_uuid,
          uuid_insanku: insanku.uuid,
        },
      });
      await savePlacementJabatan(
        transaction,
        placement,
        uuid_outlet_insanku,
      );
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

export async function resetInsanKuSlipGaji(uuid_insanku) {
  const normalized_uuid = String(uuid_insanku ?? "").trim();

  if (!normalized_uuid) {
    throw new Error("UUID InsanKu wajib diisi.");
  }

  const existing_insanku = await prisma.tbl_insanku.findFirst({
    where: {
      uuid: normalized_uuid,
      is_slip_gaji_account: true,
      deleted_at: null,
    },
    select: { uuid: true },
  });

  if (!existing_insanku) {
    throw new Error("Data InsanKu Slip Gaji tidak ditemukan.");
  }

  const [insanku_payload, outlet_insanku_payload] = await Promise.all([
    fetchInsanKuPayload(),
    fetchOutletInsanKuPayload(),
  ]);
  const source_insanku = insanku_payload.find(
    (item) => getInsanKuPayloadUuid(item) === normalized_uuid,
  );
  const username_map = normalizeOutletInsanKuUsernames(
    outlet_insanku_payload,
  );
  const default_name = String(
    source_insanku?.nama ?? source_insanku?.name ?? "",
  ).trim();
  const default_username = stripInvisibleCharacters(
    username_map.get(normalized_uuid) ?? "",
  ).trim();

  if (!source_insanku || !default_name) {
    throw new Error("Nama InsanKu tidak ditemukan pada endpoint karyawan.");
  }

  if (!default_username) {
    throw new Error(
      "Username InsanKu tidak ditemukan pada endpoint cabang_karyawan.",
    );
  }

  const username_owner = await prisma.tbl_insanku.findFirst({
    where: {
      username: default_username,
      uuid: { not: normalized_uuid },
    },
    select: { uuid: true },
  });

  if (username_owner) {
    throw new Error("Username default sudah digunakan oleh akun InsanKu lain.");
  }

  await prisma.tbl_insanku.update({
    where: { uuid: normalized_uuid },
    data: {
      name: default_name,
      username: default_username,
      is_skip_sync: false,
      is_username_change: false,
    },
  });

  const refreshed_insanku = await getInsanKuSettingsData(true);

  return {
    success: true,
    data: refreshed_insanku.find((item) => item.uuid === normalized_uuid) ?? null,
    message: "Nama dan username InsanKu berhasil direset dari Slip Gaji.",
  };
}

async function deleteInsanKuAccount({
  uuid_insanku,
  is_slip_gaji_account,
  label,
}) {
  const existing_insanku = await prisma.tbl_insanku.findFirst({
    where: {
      uuid: uuid_insanku,
      is_slip_gaji_account,
      deleted_at: null,
    },
    select: { uuid: true },
  });

  if (!existing_insanku) {
    throw new Error(`Data ${label} tidak ditemukan.`);
  }

  await prisma.$transaction(async (transaction) => {
    const deleted_at = new Date();
    await softDeleteInsanKuRelations(transaction, [uuid_insanku], deleted_at);
    await transaction.tbl_insanku.update({
      where: { uuid: uuid_insanku },
      data: { is_active: false, deleted_at },
    });
  });

  return {
    success: true,
    message: `Data ${label} berhasil dihapus.`,
  };
}

export async function deleteInsanKuSlipGaji(uuid_insanku) {
  return deleteInsanKuAccount({
    uuid_insanku,
    is_slip_gaji_account: true,
    label: "InsanKu Slip Gaji",
  });
}

export async function deleteInsanKuNonSlipGaji(uuid_insanku) {
  return deleteInsanKuAccount({
    uuid_insanku,
    is_slip_gaji_account: false,
    label: "InsanKu Non Slip Gaji",
  });
}
