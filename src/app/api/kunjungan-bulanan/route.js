import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  createKunjunganBulanan,
  deleteKunjunganBulanan,
  getKunjunganBulanan,
  updateKunjunganBulanan,
} from "@/services/kunjunganService";

export async function GET() {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-kunjungan");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getKunjunganBulanan();

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
}

export async function PUT(request) {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-kunjungan");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createKunjunganBulanan({
      uuid_outlet: body?.uuid_outlet,
      from_date: body?.from_date,
      to_date: body?.to_date,
      value: body?.value,
    });

    return NextResponse.json(data);
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
    const unauthorized_response = await requireMenuAccess("pengaturan-kunjungan");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateKunjunganBulanan({
      uuid_kunjungan_bulanan: body?.uuid_kunjungan_bulanan,
      uuid_outlet: body?.uuid_outlet,
      from_date: body?.from_date,
      to_date: body?.to_date,
      value: body?.value,
    });

    return NextResponse.json(data);
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
    const unauthorized_response = await requireMenuAccess("pengaturan-kunjungan");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await deleteKunjunganBulanan({
      uuid_kunjungan_bulanan: body?.uuid_kunjungan_bulanan,
    });

    return NextResponse.json(data);
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
