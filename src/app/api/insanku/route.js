import { NextResponse } from "next/server";
import {
  getInsanKu,
  syncInsanKu,
  updateInsanKu,
} from "@/services/insanKuService";
import { requireMenuAccess } from "@/lib/auth";

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
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateInsanKu({
      uuid_insanku: body?.uuid_insanku,
      name: body?.name,
      username: body?.username,
      password: body?.password,
      outlet_placements: body?.outlet_placements,
      outlet_uuids: body?.outlet_uuids,
      is_skip_sync_insanku: body?.is_skip_sync_insanku,
      is_skip_sync_outlet_insanku: body?.is_skip_sync_outlet_insanku,
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
