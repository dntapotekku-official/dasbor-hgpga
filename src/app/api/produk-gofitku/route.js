import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  createProdukGofitku,
  deleteProdukGofitku,
  getProdukGofitku,
  updateProdukGofitku,
} from "@/services/produkGofitkuService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess(
      ["penjualan-gofitku", "pengaturan-produk-gofitku"],
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getProdukGofitku();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const PUT = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "pengaturan-produk-gofitku",
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createProdukGofitku({
      name: body?.name,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "pengaturan-produk-gofitku",
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateProdukGofitku({
      uuid_produk_gofitku: body?.uuid_produk_gofitku,
      name: body?.name,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "pengaturan-produk-gofitku",
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await deleteProdukGofitku({
      uuid_produk_gofitku: body?.uuid_produk_gofitku,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};
