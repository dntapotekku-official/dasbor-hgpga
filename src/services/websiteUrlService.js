import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

export const website_url_keys = ["lms", "audit", "slipgaji"];

export const website_url_labels = {
  lms: "LMS",
  audit: "Audit",
  slipgaji: "Slip Gaji",
};

function normalize_key(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalize_path(value) {
  return String(value ?? "").trim();
}

function is_valid_key(key) {
  return website_url_keys.includes(key);
}

function assert_valid_path(path, label) {
  if (!path) {
    return;
  }

  if (path.startsWith("/")) {
    return;
  }

  try {
    const parsed_url = new URL(path);

    if (parsed_url.protocol === "http:" || parsed_url.protocol === "https:") {
      return;
    }
  } catch {
    // handled below
  }

  throw new Error(`URL ${label} harus berupa URL http(s) atau path yang diawali "/".`);
}

export async function getWebsiteUrls(keys = website_url_keys) {
  const normalized_keys = Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [keys])
        .map(normalize_key)
        .filter(is_valid_key),
    ),
  );
  const active_keys = normalized_keys.length ? normalized_keys : website_url_keys;
  const rows = await prisma.tbl_website_url.findMany({
    where: {
      key: {
        in: active_keys,
      },
      deleted_at: null,
    },
    select: {
      uuid: true,
      key: true,
      path: true,
    },
  });
  const row_by_key = new Map(rows.map((row) => [row.key, row]));

  return active_keys.map((key) => {
    const row = row_by_key.get(key);

    return {
      uuid: row?.uuid ?? null,
      key,
      label: website_url_labels[key] ?? key,
      path: row?.path ?? "",
      url: row?.path ?? "",
    };
  });
}

export async function saveWebsiteUrls(items = []) {
  const normalized_items = (Array.isArray(items) ? items : [])
    .map((item) => ({
      key: normalize_key(item?.key),
      path: normalize_path(item?.path ?? item?.url),
    }))
    .filter((item) => is_valid_key(item.key));

  if (!normalized_items.length) {
    throw new Error("Minimal satu URL website wajib dikirim.");
  }

  const duplicate_keys = normalized_items.map((item) => item.key);

  if (new Set(duplicate_keys).size !== duplicate_keys.length) {
    throw new Error("Key website tidak boleh duplikat.");
  }

  for (const item of normalized_items) {
    assert_valid_path(item.path, website_url_labels[item.key] ?? item.key);
  }

  const existing_rows = await prisma.tbl_website_url.findMany({
    where: {
      key: {
        in: normalized_items.map((item) => item.key),
      },
    },
    select: {
      uuid: true,
      key: true,
    },
  });
  const existing_by_key = new Map(existing_rows.map((row) => [row.key, row]));

  await prisma.$transaction(
    normalized_items.map((item) => {
      const existing_row = existing_by_key.get(item.key);

      if (existing_row) {
        return prisma.tbl_website_url.update({
          where: {
            uuid: existing_row.uuid,
          },
          data: {
            path: item.path,
            deleted_at: null,
          },
        });
      }

      return prisma.tbl_website_url.create({
        data: {
          uuid: randomUUID(),
          key: item.key,
          path: item.path,
        },
      });
    }),
  );

  return {
    success: true,
    data: await getWebsiteUrls(),
    message: "URL website berhasil disimpan.",
  };
}
