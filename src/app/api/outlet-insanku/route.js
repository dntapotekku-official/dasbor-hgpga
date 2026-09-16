import { NextResponse } from "next/server";
import {
  getOutletInsanKu,
  syncOutletInsanKu,
  updateOutletInsanKu,
} from "@/services/outletInsanKuService";
import { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-pengguna");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getOutletInsanKu();

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

    const data = await syncOutletInsanKu();

    if (!data?.success || !data.summary) {
      throw new Error("Format data outlet-insanku tidak valid.");
    }

    return NextResponse.json({
      success: true,
      data: data.data,
    });
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(
        error,
        "Terjadi kesalahan saat sinkronisasi penempatan InsanKu.",
      ),
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
    const data = await updateOutletInsanKu({
      uuid_insanku: body?.uuid_insanku,
      outlet_uuids: body?.outlet_uuids,
      is_skip_sync_outlet_insanku: body?.is_skip_sync_outlet_insanku,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      buildApiErrorResponse(
        error,
        "Terjadi kesalahan saat menyimpan penempatan InsanKu.",
      ),
      { status: 500 },
    );
  }
};
