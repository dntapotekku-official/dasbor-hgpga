import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";

function normalize_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    // Suffix seperti (HO) harus tetap dibedakan agar tidak masuk ke outlet utama.
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

/** Menandai baris impor yang memang diabaikan karena bukan outlet operasional utama. */
function should_skip_import_outlet(value) {
  return /\(\s*ho\s*\)\s*$/i.test(String(value ?? "").trim());
}

function parse_visit_date(value, label = "Tanggal kunjungan") {
  const normalized_date = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized_date)) {
    throw new Error(`${label} wajib diisi dengan format yang valid.`);
  }

  const date = new Date(`${normalized_date}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized_date
  ) {
    throw new Error(`${label} tidak valid.`);
  }

  return date;
}

function end_of_day(date) {
  return new Date(date.getTime() + 86_400_000 - 1);
}

function build_active_daily_key(uuid_outlet, date) {
  return `${uuid_outlet}:${date.toISOString().slice(0, 10)}`;
}

function to_date_key(date) {
  return date.toISOString().slice(0, 10);
}

function build_active_bulanan_key(uuid_outlet, from_date, to_date) {
  return `${uuid_outlet}:${to_date_key(from_date)}:${to_date_key(to_date)}`;
}

async function clear_daily_visit_active_keys(
  transaction,
  {
    uuid_outlet,
    date,
    exclude_uuid,
  },
) {
  await transaction.tbl_dilayani.updateMany({
    where: {
      uuid_outlet,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      date: {
        gte: date,
        lte: end_of_day(date),
      },
      active_key: {
        not: null,
      },
    },
    data: {
      active_key: null,
    },
  });
}

async function clear_bulanan_active_keys(
  transaction,
  {
    uuid_outlet,
    from_date,
    to_date,
    exclude_uuid,
  },
) {
  await transaction.tbl_dilayani_bulanan.updateMany({
    where: {
      uuid_outlet,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      from_date: {
        gte: from_date,
        lte: end_of_day(from_date),
      },
      to_date: {
        gte: to_date,
        lte: end_of_day(to_date),
      },
      active_key: {
        not: null,
      },
    },
    data: {
      active_key: null,
    },
  });
}

function parse_visit_value(value) {
  const normalized_value = String(value ?? "").trim();
  const parsed_value = Number(normalized_value);

  if (
    !normalized_value ||
    !Number.isInteger(parsed_value) ||
    parsed_value <= 0
  ) {
    throw new Error("Jumlah dilayani harus berupa bilangan bulat lebih dari nol.");
  }

  return parsed_value;
}

async function assert_active_outlet(uuid_outlet) {
  const normalized_uuid_outlet = String(uuid_outlet ?? "").trim();

  if (!normalized_uuid_outlet) {
    throw new Error("Outlet wajib dipilih.");
  }

  const outlet = await prisma.tbl_outlet.findFirst({
    where: {
      uuid: normalized_uuid_outlet,
      deleted_at: null,
      excep: false,
    },
    select: {
      uuid: true,
    },
  });

  if (!outlet) {
    throw new Error("Outlet tidak ditemukan.");
  }

  return normalized_uuid_outlet;
}

function format_kunjungan_row(item) {
  return {
    uuid: item.uuid,
    uuid_outlet: item.uuid_outlet ?? "",
    outlet_name: item.outlet?.name ?? "Outlet tidak diketahui",
    kategori: item.outlet?.category ?? "",
    date: item.date.toISOString().slice(0, 10),
    value: item.value,
    nilai_transaksi_count: item._count?.nilai_transaksi ?? 0,
    basket_size_count: item._count?.basket_size ?? 0,
  };
}

function format_kunjungan_bulanan_row(item) {
  return {
    uuid: item.uuid,
    uuid_outlet: item.uuid_outlet ?? "",
    outlet_name: item.outlet?.name ?? "Outlet tidak diketahui",
    kategori: item.outlet?.category ?? "",
    from_date: item.from_date.toISOString().slice(0, 10),
    to_date: item.to_date.toISOString().slice(0, 10),
    value: item.value,
  };
}

async function find_duplicate_kunjungan({
  uuid_outlet,
  date,
  exclude_uuid,
}) {
  return prisma.tbl_dilayani.findFirst({
    where: {
      uuid_outlet,
      deleted_at: null,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      date: {
        gte: date,
        lte: end_of_day(date),
      },
    },
    select: {
      uuid: true,
    },
  });
}

async function find_duplicate_kunjungan_bulanan({
  uuid_outlet,
  from_date,
  to_date,
  exclude_uuid,
}) {
  return prisma.tbl_dilayani_bulanan.findFirst({
    where: {
      uuid_outlet,
      deleted_at: null,
      ...(exclude_uuid
        ? {
            uuid: {
              not: exclude_uuid,
            },
          }
        : {}),
      from_date: {
        gte: from_date,
        lte: end_of_day(from_date),
      },
      to_date: {
        gte: to_date,
        lte: end_of_day(to_date),
      },
    },
    select: {
      uuid: true,
    },
  });
}

function parse_range_dates(from_date_value, to_date_value) {
  const parsed_from = parse_visit_date(from_date_value, "Tanggal dari");
  const parsed_to = parse_visit_date(to_date_value, "Tanggal sampai");

  if (parsed_from.getTime() > parsed_to.getTime()) {
    throw new Error("Tanggal dari tidak boleh lebih besar dari tanggal sampai.");
  }

  return { parsed_from, parsed_to };
}

function normalize_header(value) {
  return String(value ?? "").trim().toLowerCase();
}

function find_header_index(headers, target_header) {
  const normalized_target = normalize_header(target_header);

  return headers.findIndex((header) => normalize_header(header) === normalized_target);
}

async function parse_kunjungan_workbook(file_path) {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(file_path);

  for (const sheet of workbook.worksheets) {
    const rows = [];

    sheet.eachRow((row) => {
      rows.push(row.values.slice(1).map((cell) => {
        if (cell && typeof cell === "object" && "text" in cell) {
          return cell.text;
        }

        return cell;
      }));
    });

    for (let row_index = 0; row_index < rows.length; row_index += 1) {
      const headers = rows[row_index];
      const outlet_index = find_header_index(headers, "outlet");
      const served_index = find_header_index(headers, "dilayani");

      if (outlet_index < 0 || served_index < 0) {
        continue;
      }

      return rows
        .slice(row_index + 1)
        .map((row) => ({
          outlet_name: String(row[outlet_index] ?? "").trim(),
          served: row[served_index],
        }))
        .filter((row) => row.outlet_name);
    }
  }

  throw new Error("Format Excel tidak sesuai. Pastikan file memiliki kolom Outlet dan Dilayani.");
}

export async function getKunjungan() {
  const [data_kunjungan, data_outlet] = await Promise.all([
    prisma.tbl_dilayani.findMany({
      where: {
        deleted_at: null,
        outlet: {
          deleted_at: null,
          excep: false,
        },
      },
      orderBy: [
        {
          date: "desc",
        },
        {
          outlet: {
            name: "asc",
          },
        },
      ],
      select: {
        uuid: true,
        uuid_outlet: true,
        value: true,
        date: true,
        outlet: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    }),
    prisma.tbl_outlet.findMany({
      where: {
        deleted_at: null,
        excep: false,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uuid: true,
        name: true,
        category: true,
      },
    }),
  ]);

  return {
    data_kunjungan: data_kunjungan.map(format_kunjungan_row),
    data_outlet,
  };
}

export async function createKunjungan({
  uuid_outlet,
  date,
  value,
}) {
  const parsed_date = parse_visit_date(date);
  const parsed_value = parse_visit_value(value);
  const resolved_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const duplicate_kunjungan = await find_duplicate_kunjungan({
    uuid_outlet: resolved_uuid_outlet,
    date: parsed_date,
  });

  if (duplicate_kunjungan) {
    throw new Error("Kunjungan untuk outlet dan tanggal ini sudah ada.");
  }

  const created_kunjungan = await prisma.$transaction(async (transaction) => {
    await clear_daily_visit_active_keys(transaction, {
      uuid_outlet: resolved_uuid_outlet,
      date: parsed_date,
    });

    return transaction.tbl_dilayani.create({
      data: {
        uuid: randomUUID(),
        uuid_outlet: resolved_uuid_outlet,
        active_key: build_active_daily_key(resolved_uuid_outlet, parsed_date),
        date: parsed_date,
        value: parsed_value,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        value: true,
        date: true,
        outlet: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });
  });

  return {
    success: true,
    data: format_kunjungan_row(created_kunjungan),
    message: "Kunjungan berhasil ditambahkan.",
  };
}

export async function updateKunjungan({
  uuid_kunjungan,
  uuid_outlet,
  date,
  value,
}) {
  const normalized_uuid_kunjungan = String(uuid_kunjungan ?? "").trim();

  if (!normalized_uuid_kunjungan) {
    throw new Error("UUID kunjungan wajib diisi.");
  }

  const parsed_date = parse_visit_date(date);
  const parsed_value = parse_visit_value(value);
  const resolved_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const existing_kunjungan = await prisma.tbl_dilayani.findUnique({
    where: {
      uuid: normalized_uuid_kunjungan,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_kunjungan || existing_kunjungan.deleted_at) {
    throw new Error("Data kunjungan tidak ditemukan.");
  }

  const duplicate_kunjungan = await find_duplicate_kunjungan({
    uuid_outlet: resolved_uuid_outlet,
    date: parsed_date,
    exclude_uuid: normalized_uuid_kunjungan,
  });

  if (duplicate_kunjungan) {
    throw new Error("Kunjungan untuk outlet dan tanggal ini sudah ada.");
  }

  const updated_kunjungan = await prisma.$transaction(async (transaction) => {
    await clear_daily_visit_active_keys(transaction, {
      uuid_outlet: resolved_uuid_outlet,
      date: parsed_date,
      exclude_uuid: normalized_uuid_kunjungan,
    });

    return transaction.tbl_dilayani.update({
      where: {
        uuid: normalized_uuid_kunjungan,
      },
      data: {
        uuid_outlet: resolved_uuid_outlet,
        active_key: build_active_daily_key(resolved_uuid_outlet, parsed_date),
        date: parsed_date,
        value: parsed_value,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        value: true,
        date: true,
        outlet: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });
  });

  return {
    success: true,
    data: format_kunjungan_row(updated_kunjungan),
    message: "Kunjungan berhasil diperbarui.",
  };
}

export async function deleteKunjungan({ uuid_kunjungan }) {
  const normalized_uuid_kunjungan = String(uuid_kunjungan ?? "").trim();

  if (!normalized_uuid_kunjungan) {
    throw new Error("UUID kunjungan wajib diisi.");
  }

  const existing_kunjungan = await prisma.tbl_dilayani.findUnique({
    where: {
      uuid: normalized_uuid_kunjungan,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_kunjungan || existing_kunjungan.deleted_at) {
    throw new Error("Data kunjungan tidak ditemukan.");
  }

  await prisma.tbl_dilayani.update({
    where: {
      uuid: normalized_uuid_kunjungan,
    },
    data: {
      active_key: null,
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: "Kunjungan berhasil dihapus.",
  };
}

export async function importKunjungan({
  file_path,
  import_date,
}) {
  const parsed_date = parse_visit_date(import_date);
  const parsed_rows = await parse_kunjungan_workbook(file_path);
  const outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      excep: false,
    },
    select: {
      uuid: true,
      name: true,
    },
  });
  const outlet_map = new Map(
    outlets.map((outlet) => [normalize_outlet_name(outlet.name), outlet]),
  );
  const imported_rows = [];
  const unmatched_outlets = [];
  const duplicate_outlets = new Set();
  const seen_outlets = new Set();

  for (const row of parsed_rows) {
    if (should_skip_import_outlet(row.outlet_name)) {
      continue;
    }

    const matched_outlet = outlet_map.get(normalize_outlet_name(row.outlet_name));

    if (!matched_outlet) {
      unmatched_outlets.push(row.outlet_name);
      continue;
    }

    if (seen_outlets.has(matched_outlet.uuid)) {
      duplicate_outlets.add(matched_outlet.name);
      continue;
    }

    seen_outlets.add(matched_outlet.uuid);
    imported_rows.push({
      uuid_outlet: matched_outlet.uuid,
      outlet_name: matched_outlet.name,
      value: parse_visit_value(row.served),
    });
  }

  if (duplicate_outlets.size) {
    throw new Error(
      `File impor memiliki outlet duplikat: ${Array.from(duplicate_outlets)
        .sort((a, b) => a.localeCompare(b, "id-ID"))
        .join(", ")}.`,
    );
  }

  if (!imported_rows.length) {
    throw new Error("Tidak ada data kunjungan outlet yang cocok untuk diimpor.");
  }

  const data_kunjungan = await prisma.$transaction(async (transaction) => {
    const saved_rows = [];

    for (const row of imported_rows) {
      const existing_kunjungan = await transaction.tbl_dilayani.findFirst({
        where: {
          uuid_outlet: row.uuid_outlet,
          date: {
            gte: parsed_date,
            lte: end_of_day(parsed_date),
          },
        },
        orderBy: {
          updated_at: "desc",
        },
        select: {
          uuid: true,
        },
      });

      await clear_daily_visit_active_keys(transaction, {
        uuid_outlet: row.uuid_outlet,
        date: parsed_date,
        exclude_uuid: existing_kunjungan?.uuid,
      });

      const saved_kunjungan = existing_kunjungan
        ? await transaction.tbl_dilayani.update({
            where: {
              uuid: existing_kunjungan.uuid,
            },
            data: {
              active_key: build_active_daily_key(row.uuid_outlet, parsed_date),
              value: row.value,
              deleted_at: null,
            },
            select: {
              uuid: true,
              uuid_outlet: true,
              value: true,
              date: true,
              outlet: {
                select: {
                  name: true,
                  category: true,
                },
              },
            },
          })
        : await transaction.tbl_dilayani.create({
            data: {
              uuid: randomUUID(),
              uuid_outlet: row.uuid_outlet,
              active_key: build_active_daily_key(row.uuid_outlet, parsed_date),
              value: row.value,
              date: parsed_date,
            },
            select: {
              uuid: true,
              uuid_outlet: true,
              value: true,
              date: true,
              outlet: {
                select: {
                  name: true,
                  category: true,
                },
              },
            },
          });

      if (existing_kunjungan) {
        await transaction.tbl_dilayani.updateMany({
          where: {
            uuid_outlet: row.uuid_outlet,
            uuid: {
              not: existing_kunjungan.uuid,
            },
            deleted_at: null,
            date: {
              gte: parsed_date,
              lte: end_of_day(parsed_date),
            },
          },
          data: {
            active_key: null,
            deleted_at: new Date(),
          },
        });
      }

      saved_rows.push(format_kunjungan_row(saved_kunjungan));
    }

    return saved_rows;
  });

  return {
    success: true,
    message: `Impor kunjungan berhasil untuk ${data_kunjungan.length} outlet.`,
    data: {
      data_kunjungan,
      imported_count: data_kunjungan.length,
      unmatched_outlets,
      import_date: parsed_date.toISOString().slice(0, 10),
    },
  };
}

export async function getKunjunganBulanan() {
  const data_kunjungan_bulanan = await prisma.tbl_dilayani_bulanan.findMany({
    where: {
      deleted_at: null,
      outlet: {
        deleted_at: null,
        excep: false,
      },
    },
    orderBy: [
      {
        to_date: "desc",
      },
      {
        from_date: "desc",
      },
      {
        outlet: {
          name: "asc",
        },
      },
    ],
    select: {
      uuid: true,
      uuid_outlet: true,
      value: true,
      from_date: true,
      to_date: true,
      outlet: {
        select: {
          name: true,
          category: true,
        },
      },
    },
  });

  return {
    data_kunjungan_bulanan: data_kunjungan_bulanan.map(format_kunjungan_bulanan_row),
  };
}

export async function createKunjunganBulanan({
  uuid_outlet,
  from_date,
  to_date,
  value,
}) {
  const { parsed_from, parsed_to } = parse_range_dates(from_date, to_date);
  const parsed_value = parse_visit_value(value);
  const resolved_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const duplicate = await find_duplicate_kunjungan_bulanan({
    uuid_outlet: resolved_uuid_outlet,
    from_date: parsed_from,
    to_date: parsed_to,
  });

  if (duplicate) {
    throw new Error("Kunjungan bulanan untuk outlet dan rentang tanggal ini sudah ada.");
  }

  const created = await prisma.$transaction(async (transaction) => {
    await clear_bulanan_active_keys(transaction, {
      uuid_outlet: resolved_uuid_outlet,
      from_date: parsed_from,
      to_date: parsed_to,
    });

    return transaction.tbl_dilayani_bulanan.create({
      data: {
        uuid: randomUUID(),
        uuid_outlet: resolved_uuid_outlet,
        active_key: build_active_bulanan_key(
          resolved_uuid_outlet,
          parsed_from,
          parsed_to,
        ),
        from_date: parsed_from,
        to_date: parsed_to,
        value: parsed_value,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        value: true,
        from_date: true,
        to_date: true,
        outlet: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });
  });

  return {
    success: true,
    data: format_kunjungan_bulanan_row(created),
    message: "Kunjungan bulanan berhasil ditambahkan.",
  };
}

export async function updateKunjunganBulanan({
  uuid_kunjungan_bulanan,
  uuid_outlet,
  from_date,
  to_date,
  value,
}) {
  const normalized_uuid = String(uuid_kunjungan_bulanan ?? "").trim();

  if (!normalized_uuid) {
    throw new Error("UUID kunjungan bulanan wajib diisi.");
  }

  const { parsed_from, parsed_to } = parse_range_dates(from_date, to_date);
  const parsed_value = parse_visit_value(value);
  const resolved_uuid_outlet = await assert_active_outlet(uuid_outlet);
  const existing = await prisma.tbl_dilayani_bulanan.findUnique({
    where: {
      uuid: normalized_uuid,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing || existing.deleted_at) {
    throw new Error("Data kunjungan bulanan tidak ditemukan.");
  }

  const duplicate = await find_duplicate_kunjungan_bulanan({
    uuid_outlet: resolved_uuid_outlet,
    from_date: parsed_from,
    to_date: parsed_to,
    exclude_uuid: normalized_uuid,
  });

  if (duplicate) {
    throw new Error("Kunjungan bulanan untuk outlet dan rentang tanggal ini sudah ada.");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    await clear_bulanan_active_keys(transaction, {
      uuid_outlet: resolved_uuid_outlet,
      from_date: parsed_from,
      to_date: parsed_to,
      exclude_uuid: normalized_uuid,
    });

    return transaction.tbl_dilayani_bulanan.update({
      where: {
        uuid: normalized_uuid,
      },
      data: {
        uuid_outlet: resolved_uuid_outlet,
        active_key: build_active_bulanan_key(
          resolved_uuid_outlet,
          parsed_from,
          parsed_to,
        ),
        from_date: parsed_from,
        to_date: parsed_to,
        value: parsed_value,
      },
      select: {
        uuid: true,
        uuid_outlet: true,
        value: true,
        from_date: true,
        to_date: true,
        outlet: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });
  });

  return {
    success: true,
    data: format_kunjungan_bulanan_row(updated),
    message: "Kunjungan bulanan berhasil diperbarui.",
  };
}

export async function deleteKunjunganBulanan({ uuid_kunjungan_bulanan }) {
  const normalized_uuid = String(uuid_kunjungan_bulanan ?? "").trim();

  if (!normalized_uuid) {
    throw new Error("UUID kunjungan bulanan wajib diisi.");
  }

  const existing = await prisma.tbl_dilayani_bulanan.findUnique({
    where: {
      uuid: normalized_uuid,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing || existing.deleted_at) {
    throw new Error("Data kunjungan bulanan tidak ditemukan.");
  }

  await prisma.tbl_dilayani_bulanan.update({
    where: {
      uuid: normalized_uuid,
    },
    data: {
      active_key: null,
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: "Kunjungan bulanan berhasil dihapus.",
  };
}
