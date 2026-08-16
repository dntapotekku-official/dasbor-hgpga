import { NextResponse } from "next/server";
import {
  getKepatuhanSopCCTVChart,
  syncKepatuhanSopCCTV,
} from "@/services/kepatuhanSopCCTVService";
import { requireSession } from "@/lib/auth";

export const GET = async (request) => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const { searchParams } = new URL(request.url);
    const result = await getKepatuhanSopCCTVChart({
      tanggal_awal: searchParams.get("tanggal_awal") ?? undefined,
      tanggal_akhir: searchParams.get("tanggal_akhir") ?? undefined,
      uuid_outlet: searchParams.get("uuid_outlet") ?? undefined,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        data: result.data,
      },
      { status: result.status },
    );
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

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await syncKepatuhanSopCCTV({
      tanggal_awal: body?.tanggal_awal,
      tanggal_akhir: body?.tanggal_akhir,
      uuid_outlet: body?.uuid_outlet,
    });

    return NextResponse.json(result);
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
