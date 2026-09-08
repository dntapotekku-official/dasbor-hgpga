import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  getNilaiMagang,
  syncNilaiMagang,
} from "@/services/nilaiMagangService";

async function handle_request(action, fallback_message) {
  try {
    const unauthorized_response = await requireMenuAccess("nilai-magang");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    return NextResponse.json(await action());
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : fallback_message,
      },
      { status: 500 },
    );
  }
}

export function GET(request) {
  return handle_request(() => {
    const params = new URL(request.url).searchParams;

    return getNilaiMagang({
      month: params.get("month"),
      year: params.get("year"),
      outlet_uuid: params.get("outlet_uuid"),
    });
  }, "Gagal mengambil data nilai magang.");
}

export function POST(request) {
  return handle_request(async () => {
    const body = await request.json().catch(() => ({}));
    return syncNilaiMagang(body);
  }, "Sinkronisasi nilai magang gagal dijalankan.");
}
