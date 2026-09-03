import { NextResponse } from "next/server";

import { import_outlet_report } from "@/app/api/_helpers/import-outlet-report";
import { requireRole, requireSession } from "@/lib/auth";
import {
  createKunjungan,
  deleteKunjungan,
  getKunjungan,
  importKunjungan,
  updateKunjungan,
} from "@/services/kunjunganService";

export async function GET() {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getKunjungan();

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
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createKunjungan({
      uuid_outlet: body?.uuid_outlet,
      date: body?.date,
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

export async function POST(request) {
  return import_outlet_report(request, {
    import_handler: importKunjungan,
    temp_prefix: "kunjungan",
  });
}

export async function PATCH(request) {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateKunjungan({
      uuid_kunjungan: body?.uuid_kunjungan,
      uuid_outlet: body?.uuid_outlet,
      date: body?.date,
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
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await deleteKunjungan({
      uuid_kunjungan: body?.uuid_kunjungan,
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
