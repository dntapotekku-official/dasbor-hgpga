import { NextResponse } from "next/server";
import {
  getOutletKaryawan,
  syncOutletKaryawan,
  updateOutletKaryawan,
} from "@/services/outletKaryawanService";
import { requireRole } from "@/lib/auth";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getOutletKaryawan();

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
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await syncOutletKaryawan();

    if (!data?.success || !data.summary) {
      throw new Error("Format data outlet-karyawan tidak valid.");
    }

    return NextResponse.json({
      success: true,
      data: data.data,
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
    const data = await updateOutletKaryawan({
      uuid_karyawan: body?.uuid_karyawan,
      outlet_uuids: body?.outlet_uuids,
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
