import { NextResponse } from "next/server";
import {
  getKaryawan,
  syncKaryawan,
  updateKaryawan,
} from "@/services/karyawanService";
import { requireSession } from "@/lib/auth";

export const GET = async () => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getKaryawan();

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
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await syncKaryawan();

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
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateKaryawan({
      uuid_karyawan: body?.uuid_karyawan,
      name: body?.name,
      username: body?.username,
      outlet_uuids: body?.outlet_uuids,
      is_skip_sync_karyawan: body?.is_skip_sync_karyawan,
      is_skip_sync_outlet_karyawan: body?.is_skip_sync_outlet_karyawan,
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
