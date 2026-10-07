import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getExternalNilaiTransaksiBasketSize } from "@/services/nilaiTransaksiBasketSizeService";

function get_expected_api_key() {
  return (
    process.env.NILAI_TRANSAKSI_BASKET_SIZE_API_KEY ||
    process.env.API_KEY_PERFORMANCE_REPORT ||
    ""
  );
}

function get_request_api_key(request) {
  const header_key = request.headers.get("x-api-key");
  const authorization = request.headers.get("authorization");

  if (header_key) {
    return header_key;
  }

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
}

function is_valid_api_key(request) {
  const expected_key = get_expected_api_key();
  const request_key = get_request_api_key(request);

  if (!expected_key || !request_key) {
    return false;
  }

  const expected_buffer = Buffer.from(expected_key);
  const request_buffer = Buffer.from(request_key);

  return (
    expected_buffer.length === request_buffer.length &&
    timingSafeEqual(expected_buffer, request_buffer)
  );
}

function error_response(error, status = 500) {
  return NextResponse.json(
    {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada server.",
    },
    { status },
  );
}

export async function GET(request) {
  try {
    if (!get_expected_api_key()) {
      return error_response(
        new Error("API key nilai transaksi dan basket size belum dikonfigurasi."),
        500,
      );
    }

    if (!is_valid_api_key(request)) {
      return error_response(new Error("API key tidak valid."), 401);
    }

    const tanggal = request.nextUrl.searchParams.get("tanggal");

    if (!tanggal) {
      return error_response(new Error("Parameter tanggal wajib diisi."), 400);
    }

    const data = await getExternalNilaiTransaksiBasketSize({ tanggal });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return error_response(error, 400);
  }
}
