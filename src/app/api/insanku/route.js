import { NextResponse } from "next/server";
import {
  deleteInsanKuSlipGaji,
  getInsanKu,
  resetInsanKuSlipGaji,
  syncInsanKu,
  updateInsanKu,
} from "@/services/insanKuService";
import { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { bulkSetGofitkuExclusion } from "@/services/bulkGofitkuExclusionService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getInsanKu();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(error),
      { status: 500 },
    );
  }
};

export const POST = async () => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await syncInsanKu();

    return NextResponse.json({
      success: true,
      data: data.data,
      summary: data.summary,
    });
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(error, "Terjadi kesalahan saat sinkronisasi InsanKU."),
      { status: 500 },
    );
  }
};

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action === "bulk_gofitku_exclusion") {
      return NextResponse.json(await bulkSetGofitkuExclusion(prisma, body));
    }
    if (body?.action === "reset") {
      return NextResponse.json(
        await resetInsanKuSlipGaji(body?.uuid_insanku),
      );
    }

    const data = await updateInsanKu({
      uuid_insanku: body?.uuid_insanku,
      nik: body?.nik,
      name: body?.name,
      username: body?.username,
      password: body?.password,
      is_active: body?.is_active,
      outlet_placements: body?.outlet_placements,
      deleted_outlet_placements: body?.deleted_outlet_placements,
      outlet_uuids: body?.outlet_uuids,
      is_skip_sync_insanku: body?.is_skip_sync_insanku,
      is_skip_sync_outlet_insanku: body?.is_skip_sync_outlet_insanku,
      is_exclude_penjualan_gofitku: body?.is_exclude_penjualan_gofitku,
      gofitku_exclusion_start_date: body?.gofitku_exclusion_start_date,
      gofitku_exclusion_end_date: body?.gofitku_exclusion_end_date,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(error, "Terjadi kesalahan saat menyimpan data InsanKU."),
      { status: error.status === 409 ? 409 : 400 },
    );
  }
};

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await deleteInsanKuSlipGaji(body?.uuid_insanku);

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(error, "Terjadi kesalahan saat menghapus data InsanKU."),
      { status: 500 },
    );
  }
};
