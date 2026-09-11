import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  createTargetGlobal,
  deleteTargetGlobal,
  getTargetGlobal,
  updateTargetGlobal,
} from "@/services/nilaiTransaksiBasketSizeService";

export async function GET(request) {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    return NextResponse.json({
      success: true,
      data: await getTargetGlobal({
        key: request.nextUrl.searchParams.get("key"),
      }),
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
}

export async function PUT(request) {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await createTargetGlobal({
      key: body?.key,
      target: body?.target,
      start_date: body?.start_date,
      end_date: body?.end_date,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request) {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await updateTargetGlobal({
      uuid_target_global: body?.uuid_target_global,
      key: body?.key,
      target: body?.target,
      start_date: body?.start_date,
      end_date: body?.end_date,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request) {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await deleteTargetGlobal({
      uuid_target_global: body?.uuid_target_global,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 400 },
    );
  }
}
