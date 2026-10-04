import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

const ALL = "all";

function parse_number(value, label, min, max, allow_all = false) {
  const normalized_value = String(value ?? (allow_all ? ALL : ""))
    .trim()
    .toLowerCase();

  if (allow_all && normalized_value === ALL) {
    return null;
  }

  const number = Number(normalized_value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} tidak valid.`);
  }

  return number;
}

function parse_period({ month, year }, allow_all = false) {
  const parsed_month = parse_number(month, "Bulan", 1, 12, allow_all);
  const parsed_year = parse_number(year, "Tahun", 2000, 2100, allow_all);

  if (allow_all) {
    return {
      month: parsed_month,
      year: parsed_year,
      month_value: parsed_month === null ? ALL : String(parsed_month),
      year_value: parsed_year === null ? ALL : String(parsed_year),
    };
  }

  return {
    month: parsed_month,
    year: parsed_year,
    start_date: new Date(Date.UTC(parsed_year, parsed_month - 1, 1)),
    end_date: new Date(Date.UTC(parsed_year, parsed_month, 1)),
    key: `${parsed_year}-${String(parsed_month).padStart(2, "0")}`,
  };
}

function normalize_outlet(outlet_uuid) {
  const value = String(outlet_uuid ?? ALL).trim();
  return value && value !== ALL ? value : ALL;
}

function build_active_key(period_key, row) {
  return `${period_key}:${row.uuid_insanku}:${row.uuid_outlet}`;
}

function serialize_row(row, index) {
  return {
    rank: index + 1,
    uuid: row.uuid,
    uuid_insanku: row.uuid_insanku,
    employee_name: row.insanku?.name ?? "InsanKu tidak ditemukan",
    uuid_outlet: row.uuid_outlet,
    outlet_name: row.outlet?.name ?? "Outlet tidak ditemukan",
    value: Number(row.value),
  };
}

function summarize(rows) {
  const values = rows.map((row) => row.value);

  if (!values.length) {
    return { total_mentee: 0, average: 0, highest: 0, lowest: 0 };
  }

  return {
    total_mentee: values.length,
    average: values.reduce((total, value) => total + value, 0) / values.length,
    highest: Math.max(...values),
    lowest: Math.min(...values),
  };
}

async function fetch_slip_gaji_rows(period, selected_outlet) {
  const api_url = process.env.NILAI_MAGANG_SLIP_GAJI_API_URL;
  const api_key = process.env.APOTEKKU_API_KEY;

  if (!api_url) {
    throw new Error(
      "Environment variable NILAI_MAGANG_SLIP_GAJI_API_URL belum diatur.",
    );
  }

  if (!api_key) {
    throw new Error("Environment variable APOTEKKU_API_KEY belum diatur.");
  }

  const url = new URL(api_url);
  url.search = new URLSearchParams({
    bulan: String(period.month),
    tahun: String(period.year),
    id_outlet_magang: selected_outlet,
    sortby: "desc",
  });

  const response = await fetch(url, {
    headers: { "x-api-key": api_key },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil nilai magang dari SlipGaji: ${response.status}.`,
    );
  }

  const payload = await response.json();

  if (!payload?.success) {
    throw new Error(
      payload?.message || "API SlipGaji menolak permintaan nilai magang.",
    );
  }

  if (!Array.isArray(payload.data)) {
    throw new Error("Respons API nilai magang tidak memiliki data yang valid.");
  }

  return payload.data;
}

function normalize_api_rows(api_rows, selected_outlet) {
  const rows = new Map();

  for (const api_row of api_rows) {
    const uuid_insanku = String(api_row?.id_karyawan ?? "").trim();
    const uuid_outlet = String(api_row?.id_outlet_magang ?? "").trim();
    const value = Number(api_row?.nilai_raport);
    const employee_name = String(api_row?.nama_karyawan ?? "").trim();

    if (!uuid_insanku || !uuid_outlet || !Number.isFinite(value)) {
      throw new Error("Respons API nilai magang memuat baris yang tidak valid.");
    }

    if (value < 0 || value > 100) {
      throw new Error(
        `Nilai rapor ${employee_name || uuid_insanku} di luar rentang 0-100.`,
      );
    }

    if (selected_outlet !== ALL && uuid_outlet !== selected_outlet) {
      throw new Error("Respons API memuat outlet di luar filter yang diminta.");
    }

    rows.set(`${uuid_insanku}:${uuid_outlet}`, {
      uuid_insanku,
      uuid_outlet,
      employee_name,
      value,
    });
  }

  return [...rows.values()];
}

async function save_rows(rows, period, selected_outlet) {
  const active_keys = rows.map((row) => build_active_key(period.key, row));
  const employee_rows = [
    ...new Map(rows.map((row) => [row.uuid_insanku, row])).values(),
  ];
  const employee_uuids = employee_rows.map((row) => row.uuid_insanku);
  const outlet_uuids = [...new Set(rows.map((row) => row.uuid_outlet))];

  return prisma.$transaction(async (transaction) => {
    const [employees, outlets] = await Promise.all([
      transaction.tbl_insanku.findMany({
        where: { uuid: { in: employee_uuids } },
        select: { uuid: true },
      }),
      transaction.tbl_outlet.findMany({
        where: { uuid: { in: outlet_uuids }, deleted_at: null, is_active: true },
        select: { uuid: true },
      }),
    ]);
    const employee_set = new Set(employees.map(({ uuid }) => uuid));
    const outlet_set = new Set(outlets.map(({ uuid }) => uuid));
    const missing_outlet_count = outlet_uuids.filter(
      (uuid) => !outlet_set.has(uuid),
    ).length;

    if (missing_outlet_count) {
      throw new Error(
        `${missing_outlet_count} outlet magang dari API belum tersedia di database.`,
      );
    }

    const non_slip_employees = employee_rows.filter(
      (row) => !employee_set.has(row.uuid_insanku),
    );

    if (non_slip_employees.length) {
      await transaction.tbl_insanku.createMany({
        data: non_slip_employees.map((row) => ({
          uuid: row.uuid_insanku,
          nik: null,
          name: row.employee_name || "InsanKu Nilai Rapor",
          username: `rapor-${randomUUID()}@internal`,
          password: null,
          is_slip_gaji_account: false,
          role: "member",
        })),
      });
    }

    await transaction.tbl_nilai_magang.updateMany({
      where: {
        deleted_at: null,
        date: { gte: period.start_date, lt: period.end_date },
        ...(selected_outlet === ALL ? {} : { uuid_outlet: selected_outlet }),
        ...(active_keys.length
          ? {
              OR: [
                { active_key: null },
                { active_key: { notIn: active_keys } },
              ],
            }
          : {}),
      },
      data: { active_key: null, deleted_at: new Date() },
    });

    for (const row of rows) {
      const active_key = build_active_key(period.key, row);
      const data = {
        uuid_insanku: row.uuid_insanku,
        uuid_outlet: row.uuid_outlet,
        value: row.value,
        date: period.start_date,
        deleted_at: null,
      };

      await transaction.tbl_nilai_magang.upsert({
        where: { active_key },
        update: data,
        create: { ...data, uuid: randomUUID(), active_key },
      });
    }

    return { non_slip_count: non_slip_employees.length };
  }, { timeout: 30_000 });
}

export async function getNilaiMagang({ month, year, outlet_uuid } = {}) {
  const period = parse_period({ month, year }, true);
  const selected_outlet = normalize_outlet(outlet_uuid);
  const [database_rows, outlets] = await Promise.all([
    prisma.tbl_nilai_magang.findMany({
      where: {
        deleted_at: null,
        ...(period.year === null
          ? {}
          : {
              date: {
                gte: new Date(Date.UTC(period.year, 0, 1)),
                lt: new Date(Date.UTC(period.year + 1, 0, 1)),
              },
            }),
        ...(selected_outlet === ALL
          ? {}
          : { uuid_outlet: selected_outlet }),
      },
      orderBy: [{ value: "desc" }, { insanku: { name: "asc" } }],
      select: {
        uuid: true,
        uuid_insanku: true,
        uuid_outlet: true,
        value: true,
        date: true,
        insanku: { select: { name: true } },
        outlet: { select: { name: true } },
      },
    }),
    prisma.tbl_outlet.findMany({
      where: { deleted_at: null, is_active: true, excep: false },
      orderBy: { name: "asc" },
      select: { uuid: true, name: true },
    }),
  ]);
  const period_rows =
    period.month === null
      ? database_rows
      : database_rows.filter(
          (row) => row.date.getUTCMonth() + 1 === period.month,
        );
  const rows = period_rows.map(serialize_row);

  return {
    success: true,
    message: rows.length
      ? "Data nilai magang berhasil dimuat."
      : "Belum ada data nilai magang untuk periode yang dipilih.",
    data: {
      selected_month: period.month_value,
      selected_year: period.year_value,
      selected_outlet_uuid: selected_outlet,
      outlet_options: outlets.map(({ uuid, name }) => ({
        value: uuid,
        label: name,
      })),
      summary: summarize(rows),
      rows,
    },
  };
}

export async function syncNilaiMagang({ month, year, outlet_uuid } = {}) {
  const period = parse_period({ month, year });
  const selected_outlet = normalize_outlet(outlet_uuid);
  const api_rows = await fetch_slip_gaji_rows(period, selected_outlet);
  const rows = normalize_api_rows(api_rows, selected_outlet);
  const { non_slip_count } = await save_rows(rows, period, selected_outlet);

  return {
    success: true,
    message: `Nilai magang ${period.key} berhasil disinkronkan untuk ${rows.length} mentee${non_slip_count ? `; ${non_slip_count} akun baru disimpan sebagai Non Slip Gaji` : ""}.`,
    data: {
      period: period.key,
      synchronized_count: rows.length,
      non_slip_count,
      selected_outlet_uuid: selected_outlet,
    },
  };
}
