import { NextResponse } from "next/server";
import {
  getKepuasanInternalChart,
  syncKepuasanInternal,
} from "@/services/kepuasanInternalService";
import { requireSession } from "@/lib/auth";

export const GET = async (request) => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ?? searchParams.get("tahun") ?? undefined;
    const result = await getKepuasanInternalChart({ year });

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
    const result = await syncKepuasanInternal({
      tahun: body?.tahun ?? body?.year,
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
