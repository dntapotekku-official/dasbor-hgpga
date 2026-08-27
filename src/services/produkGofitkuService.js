import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

export async function getProdukGofitku() {
  const data_produk_gofitku = await prisma.tbl_produk_gofitku.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      uuid: true,
      name: true,
    },
  });

  return {
    data_produk_gofitku,
  };
}

export async function createProdukGofitku({ name }) {
  const trimmed_name = String(name ?? "").trim();

  if (!trimmed_name) {
    throw new Error("Nama produk wajib diisi.");
  }

  const existing_produk = await prisma.tbl_produk_gofitku.findFirst({
    where: {
      name: trimmed_name,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_produk) {
    throw new Error("Nama produk sudah digunakan.");
  }

  const created_produk = await prisma.tbl_produk_gofitku.create({
    data: {
      uuid: randomUUID(),
      name: trimmed_name,
    },
    select: {
      uuid: true,
      name: true,
    },
  });

  return {
    success: true,
    data: created_produk,
    message: "Produk GoFitKu berhasil ditambahkan.",
  };
}

export async function updateProdukGofitku({ uuid_produk_gofitku, name }) {
  if (!uuid_produk_gofitku) {
    throw new Error("UUID produk wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();

  if (!trimmed_name) {
    throw new Error("Nama produk wajib diisi.");
  }

  const existing_produk = await prisma.tbl_produk_gofitku.findUnique({
    where: {
      uuid: uuid_produk_gofitku,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_produk || existing_produk.deleted_at) {
    throw new Error("Data produk tidak ditemukan.");
  }

  const duplicate_produk = await prisma.tbl_produk_gofitku.findFirst({
    where: {
      name: trimmed_name,
      deleted_at: null,
      uuid: {
        not: uuid_produk_gofitku,
      },
    },
    select: {
      uuid: true,
    },
  });

  if (duplicate_produk) {
    throw new Error("Nama produk sudah digunakan.");
  }

  const updated_produk = await prisma.$transaction(async (transaction) => {
    const next_produk = await transaction.tbl_produk_gofitku.update({
      where: {
        uuid: uuid_produk_gofitku,
      },
      data: {
        name: trimmed_name,
      },
      select: {
        uuid: true,
        name: true,
      },
    });

    await transaction.tbl_penjualan_gofitku.updateMany({
      where: {
        uuid_produk_gofitku,
        deleted_at: null,
      },
      data: {
        name: trimmed_name,
      },
    });

    return next_produk;
  });

  return {
    success: true,
    data: updated_produk,
    message: "Produk GoFitKu berhasil diperbarui.",
  };
}

export async function deleteProdukGofitku({ uuid_produk_gofitku }) {
  if (!uuid_produk_gofitku) {
    throw new Error("UUID produk wajib diisi.");
  }

  const existing_produk = await prisma.tbl_produk_gofitku.findUnique({
    where: {
      uuid: uuid_produk_gofitku,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_produk || existing_produk.deleted_at) {
    throw new Error("Data produk tidak ditemukan.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.tbl_penjualan_gofitku.updateMany({
      where: {
        uuid_produk_gofitku,
      },
      data: {
        uuid_produk_gofitku: null,
      },
    });

    await transaction.tbl_produk_gofitku.delete({
      where: {
        uuid: uuid_produk_gofitku,
      },
    });
  });

  return {
    success: true,
    message: "Produk GoFitKu berhasil dihapus.",
  };
}
