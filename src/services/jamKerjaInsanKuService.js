import { createHash, randomUUID } from "node:crypto";
import { parseKegiatanDuration } from "../lib/kegiatanDuration.js";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { uploadFile, downloadFile, deleteFile, getPublicFileUrl } from "../lib/cloudStorage.js";
import { getImageType, readImageUpload } from "../lib/imageUpload.js";
import { prisma } from "@/lib/prisma";

// ============================================================================
// Helper validasi dan pembacaan penempatan InsanKU
// ============================================================================

/** Memvalidasi jam kerja sebagai angka nonnegatif, termasuk jam desimal. */
function parse_hours(value, label) {
  const hours = Number(value);

  if (
    value == null ||
    String(value).trim() === "" ||
    typeof value === "boolean" ||
    !Number.isFinite(hours) ||
    hours < 0
  ) {
    throw new Error(`${label} wajib berupa angka nonnegatif yang valid.`);
  }

  return hours;
}

/** Memvalidasi bulan dan tahun serta membentuk batas periode dalam UTC. */
function parse_period({ month, year } = {}) {
  const current = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Makassar",
      month: "2-digit",
      year: "numeric",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );

  const selected_month = String(month ?? current.month);

  const selected_year = String(year ?? current.year);

  if (
    !/^\d{1,2}$/.test(selected_month) ||
    !/^\d{4}$/.test(selected_year) ||
    Number(selected_month) < 1 ||
    Number(selected_month) > 12 ||
    Number(selected_year) < 1000
  ) {
    throw new Error("Bulan dan tahun jam kerja tidak valid.");
  }

  const start = new Date(
    Date.UTC(Number(selected_year), Number(selected_month) - 1, 1),
  );

  const end = new Date(
    Date.UTC(Number(selected_year), Number(selected_month), 1),
  );

  return { start, end };
}

/** Membentuk UUID tetap per penempatan dan bulan agar penyimpanan bersamaan tidak membuat rekap ganda. */
function build_monthly_uuid(placement_uuid, date) {
  const hash = createHash("sha256")
    .update(`${placement_uuid}:${date.toISOString().slice(0, 7)}`)
    .digest("hex");

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** Mengambil penempatan dan rekap terakhir; akun outlet hanya dapat mengakses penempatannya sendiri. */
async function get_placements(
  client,
  ids,
  access = {},
  period = parse_period(),
) {
  const is_outlet =
    String(access.role ?? "")
      .trim()
      .toLowerCase() === "member";

  if (is_outlet && !access.uuid) throw new Error("Akun outlet tidak valid.");

  return client.tbl_outlet_insanku.findMany({
    where: {
      deleted_at: null,
      insanku: { is: { deleted_at: null } },
      outlet: { is: { deleted_at: null } },
      ...(ids ? { uuid: { in: ids } } : {}),
      ...(is_outlet ? { uuid_outlet: access.uuid } : {}),
    },
    include: {
      insanku: { select: { name: true } },
      outlet: { select: { name: true } },
      jam_kerja_insanku_bulanan: {
        where: { date: { gte: period.start, lt: period.end } },
        orderBy: { id: "desc" },
        take: 1,
      },
    },
    orderBy: { id: "asc" },
  });
}

// ============================================================================
// Rekap jam kerja dan mutasi data
// ============================================================================

/** Menampilkan seluruh penempatan pada bulan terpilih; nilai rekap yang pernah dihapus ditampilkan sebagai nol. */
export async function getJamKerjaInsanKu(access = {}, filters = {}) {
  const period = parse_period(filters);

  const placements = await get_placements(prisma, undefined, access, period);

  return {
    success: true,
    data: placements.map((item) => {
      const latest = item.jam_kerja_insanku_bulanan[0];

      const record = latest?.deleted_at ? null : latest;

      return {
        id: item.uuid,
        name: item.insanku.name,
        outlet: item.outlet.name,
        pharmaapp: record?.pharmapp_value ?? 0,
        excel: record?.excel_value ?? 0,
        verified: record?.is_verfified ?? false,
        validated: record?.is_validated ?? false,
      };
    }),
  };
}

/** Menyimpan jam kerja atau checkbox secara atomik pada bulan dan tahun terpilih tanpa mengubah periode lain. */
export async function updateJamKerjaInsanKu(payload, access = {}) {
  const period = parse_period(payload);

  const ids = [
    ...new Set(Array.isArray(payload.ids) ? payload.ids : [payload.id]),
  ];

  if (
    !ids.length ||
    ids.some((id) => typeof id !== "string" || !/^[a-f\d-]{36}$/i.test(id))
  ) {
    throw new Error("Penempatan InsanKU tidak valid.");
  }

  const data = {};

  if ("pharmaapp" in payload)
    data.pharmapp_value = parse_hours(payload.pharmaapp, "Jam kerja PharmApp");

  if ("excel" in payload)
    data.excel_value = parse_hours(payload.excel, "Jam kerja Mandiri");

  for (const [field, column] of [
    ["verified", "is_verfified"],
    ["validated", "is_validated"],
  ]) {
    if (field in payload) {
      if (typeof payload[field] !== "boolean")
        throw new Error("Status checkbox tidak valid.");

      data[column] = payload[field];
    }
  }

  if (!Object.keys(data).length)
    throw new Error("Tidak ada perubahan untuk disimpan.");

  await prisma.$transaction(async (tx) => {
    const placements = await get_placements(tx, ids, access, period);

    if (placements.length !== ids.length) {
      throw new Error(
        "Data jam kerja atau penempatan sudah tidak tersedia. Muat ulang halaman.",
      );
    }

    for (const placement of placements) {
      const uuid =
        placement.jam_kerja_insanku_bulanan[0]?.uuid ??
        build_monthly_uuid(placement.uuid, period.start);

      await tx.tbl_jam_kerja_insanku_bulanan.upsert({
        where: { uuid },
        create: {
          uuid,
          uuid_outlet_insanku: placement.uuid,
          date: period.start,
          ...data,
        },
        update: {
          ...(placement.jam_kerja_insanku_bulanan[0]?.deleted_at
            ? {
                pharmapp_value: 0,
                excel_value: 0,
                is_verfified: false,
                is_validated: false,
              }
            : {}),
          ...data,
          deleted_at: null,
        },
      });
    }
  });

  return { success: true, message: "Jam kerja InsanKU berhasil disimpan." };
}

/** Mengosongkan nilai jam PharmApp dan Mandiri pada bulan terpilih tanpa menghapus baris atau mengubah periode lain. */
export async function deleteJamKerjaInsanKu({ id, month, year }, access = {}) {
  const period = parse_period({ month, year });

  if (typeof id !== "string" || !/^[a-f\d-]{36}$/i.test(id))
    throw new Error("Penempatan InsanKU tidak valid.");

  await prisma.$transaction(async (tx) => {
    const [placement] = await get_placements(tx, [id], access, period);

    if (!placement) throw new Error("Penempatan InsanKU tidak ditemukan.");

    const uuid =
      placement.jam_kerja_insanku_bulanan[0]?.uuid ??
      build_monthly_uuid(placement.uuid, period.start);

    const cleared_values = {
      pharmapp_value: 0,
      excel_value: 0,
      deleted_at: null,
    };

    await tx.tbl_jam_kerja_insanku_bulanan.upsert({
      where: { uuid },
      create: {
        uuid,
        uuid_outlet_insanku: id,
        date: period.start,
        ...cleared_values,
      },
      update: cleared_values,
    });
  });

  return { success: true, message: "Nilai jam kerja berhasil dihapus." };
}

// ============================================================================
// Kegiatan harian dan foto kegiatan
// ============================================================================

/** Memvalidasi penempatan dan membentuk batas bulan kegiatan yang diminta. */
function parse_scope(payload) {
  const { id, month, year } = payload;
  if (typeof id !== "string" || !/^[a-f\d-]{36}$/i.test(id))
    throw new Error("Penempatan InsanKU tidak valid.");
  if (
    !/^\d{1,2}$/.test(String(month)) ||
    Number(month) < 1 ||
    Number(month) > 12 ||
    !/^\d{4}$/.test(String(year)) ||
    Number(year) < 1000
  )
    throw new Error("Bulan dan tahun kegiatan tidak valid.");
  return {
    id,
    start: new Date(Date.UTC(Number(year), Number(month) - 1, 1)),
    end: new Date(Date.UTC(Number(year), Number(month), 1)),
  };
}

/** Memastikan pengguna memiliki akses ke penempatan InsanKU yang diminta. */
async function assert_placement(id, access) {
  const member = String(access.role ?? "").toLowerCase() === "member";
  if (member && !access.uuid) throw new Error("Akun outlet tidak valid.");
  const placement = await prisma.tbl_outlet_insanku.findFirst({
    where: {
      uuid: id,
      deleted_at: null,
      insanku: { is: { deleted_at: null } },
      outlet: { is: { deleted_at: null } },
      ...(member ? { uuid_outlet: access.uuid } : {}),
    },
    select: { uuid: true },
  });
  if (!placement)
    throw new Error(
      "Penempatan InsanKU tidak ditemukan atau tidak dapat diakses.",
    );
}

/** Mengenali referensi foto yang tersimpan di Google Cloud Storage. */
function is_cloud_photo(reference) {
  return typeof reference === "string" && (
    reference.startsWith("gs://") ||
    reference.startsWith("https://storage.googleapis.com/")
  );
}

/** Menyiapkan tanggal, durasi, dan URL foto kegiatan untuk respons API. */
function serialize(row) {
  return {
    uuid: row.uuid,
    date: row.date.toISOString().slice(0, 10),
    description: row.description ?? "",
    hours_value: row.hours_value,
    img_url: is_cloud_photo(row.img_url)
      ? getPublicFileUrl(row.img_url, { folder: kegiatan_photo_folder })
      : row.img_url
        ? `/api/jam-kerja-insanku/kegiatan/${row.uuid}/foto?v=${encodeURIComponent(row.img_url)}`
        : null,
  };
}

/** Mengambil kegiatan penempatan pada bulan terpilih setelah pemeriksaan akses. */
export async function getJamKerjaKegiatan(payload, access = {}) {
  const scope = parse_scope(payload);

  await assert_placement(scope.id, access);

  const rows = await prisma.tbl_jam_kerja_insanku_harian.findMany({
    where: {
      uuid_outlet_insanku: scope.id,
      deleted_at: null,
      date: { gte: scope.start, lt: scope.end },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return { success: true, data: rows.map(serialize) };
}

/** Memvalidasi tanggal, deskripsi, dan durasi kegiatan sebelum penyimpanan. */
function parse_details(payload, scope) {
  const date = new Date(`${payload.date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date)) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== payload.date ||
    date < scope.start ||
    date >= scope.end
  )
    throw new Error(
      "Tanggal kegiatan harus valid dan berada dalam periode terpilih.",
    );
  const description = String(payload.description ?? "").trim();
  if (!description) throw new Error("Deskripsi kegiatan wajib diisi.");
  if (description.length > 10000)
    throw new Error("Deskripsi kegiatan maksimal 10.000 karakter.");
  const hours_value = parseKegiatanDuration(payload.hours_value);
  return { date, description, hours_value };
}

const kegiatan_photo_folder = "jam-kerja-kegiatan";

/** Membentuk path foto lokal lama tanpa menerima traversal direktori. */
function legacy_photo_path(filename) {
  if (!/^[a-f\d-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    throw new Error("Foto kegiatan tidak valid.");
  }

  return path.join(process.cwd(), ".data", kegiatan_photo_folder, filename);
}

/** Menghapus foto di GCS atau file lokal lama sesuai referensi penyimpanannya. */
async function remove_kegiatan_photo(reference) {
  if (is_cloud_photo(reference)) {
    return deleteFile(reference, { folder: kegiatan_photo_folder });
  }

  await unlink(legacy_photo_path(reference)).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

/** Mengunggah foto dan menyimpan kegiatan; membersihkan foto bila penulisan gagal. */
export async function createJamKerjaKegiatan(payload, file, access = {}) {
  const scope = parse_scope(payload);

  await assert_placement(scope.id, access);

  const { date, description, hours_value } = parse_details(payload, scope);

  const uuid = randomUUID();

  const image = await readImageUpload(file);

  const img_url = await uploadFile({
    folder: kegiatan_photo_folder,
    filename: `${uuid}.${image.extension}`,
    buffer: image.bytes,
    contentType: image.mime,
    publicUrl: true,
  });

  let row;

  try {
    row = await prisma.tbl_jam_kerja_insanku_harian.create({
      data: {
        uuid,
        uuid_outlet_insanku: scope.id,
        date,
        description,
        hours_value,
        img_url,
      },
    });
  } catch (error) {
    await remove_kegiatan_photo(img_url);

    throw error;
  }

  return {
    success: true,
    data: serialize(row),
    message: "Kegiatan berhasil ditambahkan.",
  };
}

/** Membaca foto kegiatan setelah memeriksa akses pengguna dan status kegiatan. */
export async function getJamKerjaKegiatanPhoto(uuid, access = {}) {
  if (!/^[a-f\d-]{36}$/i.test(uuid)) {
    throw new Error("Foto kegiatan tidak ditemukan.");
  }

  const row = await prisma.tbl_jam_kerja_insanku_harian.findFirst({
    where: { uuid, deleted_at: null },
    select: { uuid_outlet_insanku: true, img_url: true },
  });

  if (!row?.img_url) {
    throw new Error("Foto kegiatan tidak ditemukan.");
  }

  await assert_placement(row.uuid_outlet_insanku, access);

  const bytes = is_cloud_photo(row.img_url)
    ? await downloadFile(row.img_url, { folder: kegiatan_photo_folder })
    : await readFile(legacy_photo_path(row.img_url));

  return { bytes, mime: getImageType(bytes).mime };
}

/** Mencari kegiatan yang belum dihapus dalam penempatan dan periode yang diizinkan. */
async function find_activity(payload, access) {
  const scope = parse_scope(payload);

  await assert_placement(scope.id, access);
  if (typeof payload.uuid !== "string" || !/^[a-f\d-]{36}$/i.test(payload.uuid))
    throw new Error("Kegiatan tidak valid.");
  const where = {
    uuid: payload.uuid,
    uuid_outlet_insanku: scope.id,
    deleted_at: null,
    date: { gte: scope.start, lt: scope.end },
  };
  const row = await prisma.tbl_jam_kerja_insanku_harian.findFirst({ where });
  if (!row)
    throw new Error(
      "Kegiatan tidak ditemukan pada penempatan dan periode ini.",
    );
  return { row, where, scope };
}

/** Memperbarui kegiatan dan foto pengganti dengan pembersihan file yang tidak terpakai. */
export async function updateJamKerjaKegiatan(payload, file, access = {}) {
  const { row, where, scope } = await find_activity(payload, access);

  const data = parse_details(payload, scope);

  let replacement = null;

  if (file?.size) {
    const image = await readImageUpload(file);

    replacement = await uploadFile({
      folder: kegiatan_photo_folder,
      filename: `${randomUUID()}.${image.extension}`,
      buffer: image.bytes,
      contentType: image.mime,
      publicUrl: true,
    });
  }

  if (replacement) {
    data.img_url = replacement;
  }

  let updated;

  try {
    updated = await prisma.$transaction(async (tx) => {
      const result = await tx.tbl_jam_kerja_insanku_harian.updateMany({
        where: { ...where, ...(replacement ? { img_url: row.img_url } : {}) },
        data,
      });
      if (!result.count) {
        throw new Error(
          "Kegiatan sudah berubah atau dihapus. Muat ulang dan coba kembali.",
        );
      }

      return tx.tbl_jam_kerja_insanku_harian.findFirst({
        where: { uuid: row.uuid },
      });
    });
  } catch (error) {
    if (replacement) {
      await remove_kegiatan_photo(replacement);
    }

    throw error;
  }

  if (replacement && row.img_url) {
    await remove_kegiatan_photo(row.img_url).catch(() => {});
  }

  return {
    success: true,
    data: serialize(updated),
    message: "Kegiatan berhasil diperbarui.",
  };
}

/** Menandai kegiatan sebagai dihapus tanpa menghapus riwayat fisiknya. */
export async function deleteJamKerjaKegiatan(payload, access = {}) {
  const { row, where } = await find_activity(payload, access);
  const result = await prisma.tbl_jam_kerja_insanku_harian.updateMany({
    where,
    data: { deleted_at: new Date() },
  });
  if (!result.count)
    throw new Error("Kegiatan sudah dihapus. Muat ulang daftar kegiatan.");
  return {
    success: true,
    uuid: row.uuid,
    message: "Kegiatan berhasil dihapus.",
  };
}
