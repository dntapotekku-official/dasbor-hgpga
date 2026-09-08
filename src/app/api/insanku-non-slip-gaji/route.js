import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  createInsanKuNonSlipGaji,
  deleteInsanKuNonSlipGaji,
  getInsanKuNonSlipGaji,
  updateInsanKuNonSlipGaji,
} from "@/services/insanKuService";

async function handle_request(action, fallback_message, error_status = 400) {
  try {
    const unauthorized_response = await requireMenuAccess(
      "pengaturan-pengguna",
    );

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
      { status: error_status },
    );
  }
}

async function read_body(request) {
  return request.json().catch(() => ({}));
}

export function GET() {
  return handle_request(
    async () => ({ success: true, data: await getInsanKuNonSlipGaji() }),
    "Gagal mengambil data InsanKu Non Slip Gaji.",
    500,
  );
}

export function POST(request) {
  return handle_request(
    async () => createInsanKuNonSlipGaji(await read_body(request)),
    "Gagal menambahkan InsanKu Non Slip Gaji.",
  );
}

export function PATCH(request) {
  return handle_request(
    async () => updateInsanKuNonSlipGaji(await read_body(request)),
    "Gagal memperbarui InsanKu Non Slip Gaji.",
  );
}

export function DELETE(request) {
  return handle_request(
    async () => {
      const body = await read_body(request);
      return deleteInsanKuNonSlipGaji(body?.uuid_insanku);
    },
    "Gagal menghapus InsanKu Non Slip Gaji.",
  );
}
