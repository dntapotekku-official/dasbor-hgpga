import { NextResponse } from "next/server";
import {
  getOutlet,
  syncOutlet,
  updateOutlet,
  updateOutletException,
} from "@/services/outletService";
import { requireRole, requireSession } from "@/lib/auth";

export const GET = async (request) => {
  try {
    const include_excluded =
      request.nextUrl.searchParams.get("include_excluded") === "true";
    const unauthorized_response = include_excluded
      ? await requireRole(["admin"])
      : await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getOutlet({ include_excluded });

    return NextResponse.json({
      success: true,
      data: {
        data_outlet: data.data_outlet,
      },
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

export const POST = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await syncOutlet();

    return NextResponse.json({
      success: true,
      data: data.data,
      summary: data.summary,
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

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = body?.action === "update_exception"
      ? await updateOutletException({
          uuid_outlet: body?.uuid_outlet,
          excep: body?.excep,
        })
      : await updateOutlet({
          uuid_outlet: body?.uuid_outlet,
          name: body?.name,
          kategori: body?.kategori,
          is_skip_sync: body?.is_skip_sync,
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
