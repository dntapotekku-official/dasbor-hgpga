import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

function formatDateParam(date) {
  return date.toISOString().slice(0, 10);
}

function to_negative_value(value) {
  const numeric_value = Math.abs(Number(value) || 0);

  return numeric_value === 0 ? 0 : -numeric_value;
}

function getDefaultDateParams() {
  const today = new Date();
  const start_of_month = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );

  return {
    tanggal_awal: formatDateParam(start_of_month),
    tanggal_akhir: formatDateParam(today),
  };
}

function buildDashboardPayload(rows, outlet_options = [], chart_data = []) {
  const total = rows.reduce((sum, item) => sum + item.total, 0);
  const total_point = rows.reduce((sum, item) => sum + item.total_point, 0);

  return {
    rows,
    outlet_options,
    chart_data,
    summary: {
      total,
      total_point,
    },
  };
}

export async function getKepatuhanSopCCTVChart({
  tanggal_awal,
  tanggal_akhir,
  uuid_outlet,
} = {}) {
  const default_dates = getDefaultDateParams();
  const start_date = new Date(
    `${tanggal_awal ?? default_dates.tanggal_awal}T00:00:00.000Z`,
  );
  const end_date = new Date(
    `${tanggal_akhir ?? default_dates.tanggal_akhir}T23:59:59.999Z`,
  );

  const [outlet_rows, rows] = await Promise.all([
    prisma.tbl_outlet.findMany({
      where: { deleted_at: null },
      orderBy: { name: "asc" },
      select: { uuid: true, name: true },
    }),
    prisma.tbl_kepatuhan_sop_cctv.findMany({
      where: {
        deleted_at: null,
        date: {
          gte: start_date,
          lte: end_date,
        },
        ...(uuid_outlet ? { uuid_outlet } : {}),
      },
      select: {
        uuid_outlet: true,
        date: true,
        total: true,
        total_point: true,
        outlet: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { outlet: { name: "asc" } }],
    }),
  ]);
  const outlet_options = outlet_rows.map((item) => ({
    value: item.uuid,
    uuid_outlet: item.uuid,
    id_outlet: item.uuid,
    label: item.name,
  }));

  if (!rows.length) {
    return {
      success: false,
      status: 404,
      message: "Data kepatuhan SOP CCTV pada rentang tanggal ini belum tersedia.",
      data: buildDashboardPayload([], outlet_options),
    };
  }

  const chart_map = new Map();
  const outlet_map = new Map();

  for (const item of rows) {
    const chart_key = formatDateParam(item.date);
    const chart_value = chart_map.get(chart_key) ?? {
      date: chart_key,
      total: 0,
      total_point: 0,
    };
    const outlet_value = outlet_map.get(item.uuid_outlet) ?? {
      uuid_outlet: item.uuid_outlet,
      nama_outlet: item.outlet?.name ?? "Outlet tidak diketahui",
      total: 0,
      total_point: 0,
    };

    chart_value.total += Number(item.total) || 0;
    chart_value.total_point += to_negative_value(item.total_point);
    outlet_value.total += Number(item.total) || 0;
    outlet_value.total_point += to_negative_value(item.total_point);
    chart_map.set(chart_key, chart_value);
    outlet_map.set(item.uuid_outlet, outlet_value);
  }

  const rows_data = Array.from(outlet_map.values()).sort((a, b) =>
    a.nama_outlet.localeCompare(b.nama_outlet, "id-ID"),
  );

  return {
    success: true,
    status: 200,
    message: "Data kepatuhan SOP CCTV berhasil dimuat.",
    data: buildDashboardPayload(
      rows_data,
      outlet_options,
      Array.from(chart_map.values()),
    ),
  };
}

export async function syncKepatuhanSopCCTV({
  tanggal_awal,
  tanggal_akhir,
  id_outlet,
} = {}) {
  const default_dates = getDefaultDateParams();
  const start_date = tanggal_awal ?? default_dates.tanggal_awal;
  const end_date = tanggal_akhir ?? default_dates.tanggal_akhir;

  if (!process.env.SOP_CCTV_API_URL) {
    throw new Error("SOP_CCTV_API_URL belum dikonfigurasi.");
  }

  const chart_dates = [];
  const chart_start_date = new Date(`${start_date}T00:00:00.000Z`);
  const chart_end_date = new Date(`${end_date}T00:00:00.000Z`);

  if (
    !Number.isNaN(chart_start_date.getTime()) &&
    !Number.isNaN(chart_end_date.getTime())
  ) {
    for (
      let date = chart_start_date;
      date <= chart_end_date;
      date = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    ) {
      chart_dates.push(formatDateParam(date));
    }
  }

  if (!chart_dates.length) {
    throw new Error("Rentang tanggal kepatuhan SOP CCTV tidak valid.");
  }

  const rows_to_upsert = [];
  for (const date of chart_dates) {
    const search_params = new URLSearchParams({
      tanggal_awal: date,
      tanggal_akhir: date,
    });

    if (id_outlet) {
      search_params.set("id_outlet", id_outlet);
    }

    const result = await fetch(
      `${process.env.SOP_CCTV_API_URL}?${search_params.toString()}`,
      {
        headers: {
          "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
        },
        cache: "no-store",
      },
    );

    if (!result.ok) {
      throw new Error(
        `Gagal menyinkronkan data kepatuhan SOP CCTV: ${result.status}`,
      );
    }

    const data = await result.json();

    if (data?.success === false) {
      throw new Error(
        data.message || "Sinkronisasi kepatuhan SOP CCTV gagal dijalankan.",
      );
    }

    const payload_rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : [];

    for (const item of payload_rows) {
      if (!item?.id_outlet) {
        continue;
      }

      rows_to_upsert.push({
        uuid_outlet: item.id_outlet,
        date: new Date(`${date}T00:00:00.000Z`),
        total: Number(item.total) || 0,
        total_point: to_negative_value(item.total_point),
      });
    }
  }

  const deduped_rows = Array.from(
    new Map(
      rows_to_upsert.map((item) => [
        `${item.uuid_outlet}-${item.date.toISOString()}`,
        item,
      ]),
    ).values(),
  );

  if (!deduped_rows.length) {
    throw new Error("Data kepatuhan SOP CCTV dari API tidak valid.");
  }

  const valid_outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
      uuid: {
        in: Array.from(new Set(deduped_rows.map((item) => item.uuid_outlet))),
      },
    },
    select: {
      uuid: true,
    },
  });
  const valid_outlet_ids = new Set(valid_outlets.map((item) => item.uuid));
  const valid_rows = deduped_rows.filter(
    (item) => valid_outlet_ids.has(item.uuid_outlet),
  );
  const skipped_rows = deduped_rows.length - valid_rows.length;

  if (!valid_rows.length) {
    throw new Error(
      "Semua outlet dari API CCTV belum tersedia di master outlet.",
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const item of valid_rows) {
      await tx.tbl_kepatuhan_sop_cctv.upsert({
        where: {
          uuid_outlet_date: {
            uuid_outlet: item.uuid_outlet,
            date: item.date,
          },
        },
        update: {
          total: item.total,
          total_point: item.total_point,
          deleted_at: null,
        },
        create: {
          uuid: randomUUID(),
          uuid_outlet: item.uuid_outlet,
          date: item.date,
          total: item.total,
          total_point: item.total_point,
        },
      });
    }
  });

  const chart_result = await getKepatuhanSopCCTVChart({
    tanggal_awal: start_date,
    tanggal_akhir: end_date,
    uuid_outlet: id_outlet,
  });

  return {
    success: true,
    status: 200,
    message: skipped_rows
      ? `Data kepatuhan SOP CCTV berhasil disimpan. ${skipped_rows} data outlet dilewati karena belum ada di master outlet.`
      : "Data kepatuhan SOP CCTV berhasil disimpan.",
    data: chart_result.data,
  };
}
