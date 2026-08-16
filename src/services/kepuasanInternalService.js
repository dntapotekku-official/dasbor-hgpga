import { prisma } from "@/lib/prisma";

export async function getKepuasanInternalChart({ year } = {}) {
  const parsed_year = Number(year);

  if (year && !parsed_year) {
    throw new Error("Tahun tidak valid.");
  }

  const rows = await prisma.tbl_kepuasan_internal.findMany({
    where: {
      deleted_at: null,
      ...(parsed_year
        ? {
            date: {
              gte: new Date(Date.UTC(parsed_year, 0, 1)),
              lt: new Date(Date.UTC(parsed_year + 1, 0, 1)),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
    select: { date: true, puas: true, tidak_puas: true },
  });

  if (!rows.length) {
    return {
      success: false,
      status: 404,
      message: "Data kepuasan internal belum tersedia di database.",
      data: null,
    };
  }

  const labels = rows.map(
    (item) =>
      `${item.date.getUTCFullYear()}-${String(item.date.getUTCMonth() + 1).padStart(2, "0")}`,
  );

  return {
    success: true,
    status: 200,
    message: "Data kepuasan internal berhasil dimuat dari database.",
    data: {
      labels,
      series: [
        { key: "puas", label: "Puas" },
        { key: "tidak_puas", label: "Tidak Puas" },
      ],
      chart_data: rows.map((item, index) => ({
        month: labels[index],
        puas: item.puas,
        tidak_puas: item.tidak_puas,
      })),
    },
  };
}

export async function syncKepuasanInternal() {
  const result = await fetch(process.env.KEPUASAN_INTERNAL_API_URL, {
    headers: {
      "x-api-key": process.env.KEPUASAN_INTERNAL_API_KEY,
    },
    cache: "no-store",
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan data kepuasan internal: ${result.status}`);
  }

  const data = await result.json();

  if (!data.success) {
    throw new Error(data.message || "Sinkronisasi kepuasan internal gagal dijalankan.");
  }

  const monthly_review = data?.data ?? data;
  const labels = Array.isArray(monthly_review?.labels)
    ? monthly_review.labels
    : [];
  const raw_series =
    monthly_review?.series && typeof monthly_review.series === "object"
      ? monthly_review.series
      : null;

  if (!labels.length || !raw_series) {
    throw new Error("Data kepuasan internal tidak memiliki label bulan yang valid.");
  }

  const series = Object.entries(raw_series).map(([label, values]) => ({
    key: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, ""),
    values: Array.isArray(values) ? values : [],
  }));
  const monthly_rows = labels.map((month_label, index) => {
    const [year, month] = month_label.split("-").map(Number);

    if (!year || !month || month < 1 || month > 12) {
      throw new Error(`Format bulan tidak valid: ${month_label}`);
    }

    const values = Object.fromEntries(
      series.map((item) => [item.key, Number(item.values[index]) || 0]),
    );

    return {
      date: new Date(Date.UTC(year, month - 1, 1)),
      puas: values.puas || 0,
      tidak_puas: values.tidak_puas || 0,
    };
  });

  await prisma.$transaction(
    monthly_rows.map((item) =>
      prisma.tbl_kepuasan_internal.upsert({
        where: { date: item.date },
        update: {
          puas: item.puas,
          tidak_puas: item.tidak_puas,
          deleted_at: null,
        },
        create: item,
      }),
    ),
  );

  return {
    success: true,
    status: 200,
    message: "Data kepuasan internal berhasil disimpan.",
    data: monthly_rows.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      puas: item.puas,
      tidak_puas: item.tidak_puas,
    })),
    summary: {
      total_bulan: monthly_rows.length,
    },
  };
}
