import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getExternalPenjualanGofitkuDetail } from "@/services/penjualanGofitkuService";

function get_expected_api_key() {
  return (
    process.env.PENJUALAN_GOFITKU_API_KEY ||
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
        new Error("API key Penjualan GoFitKu belum dikonfigurasi."),
        500,
      );
    }

    if (!is_valid_api_key(request)) {
      return error_response(new Error("API key tidak valid."), 401);
    }

    const { searchParams } = new URL(request.url);
    const data = await getExternalPenjualanGofitkuDetail({
      date: searchParams.get("date") ?? searchParams.get("tanggal"),
      uuid_outlet: searchParams.get("uuid_outlet"),
      outlet_name: searchParams.get("outlet_name"),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return error_response(error, 400);
  }
}
