import { NextResponse } from "next/server";
import {
  getOutlet,
  importOutletCredentials,
  syncOutlet,
  updateOutlet,
  updateOutletException,
} from "@/services/outletService";
import getCurrentUser, { requireMenuAccess } from "@/lib/auth";

export const GET = async (request) => {
  try {
    const include_excluded =
      request.nextUrl.searchParams.get("include_excluded") === "true";
    const unauthorized_response = include_excluded
      ? await requireMenuAccess("pengaturan-outlet")
      : await requireMenuAccess(
          [
            "dashboard",
            "kepatuhan-sop-cctv",
            "penjualan-gofitku",
            "nilai-transaksi-basket-size",
            "pengaturan-pengguna",
            "pengaturan-kunjungan",
            "pengaturan-target",
          ],
          ["member"],
        );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const data = await getOutlet({
      include_excluded,
      member_outlet_uuid:
        user_session?.role === "member" ? user_session.uuid : undefined,
    });

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
    const unauthorized_response = await requireMenuAccess("pengaturan-outlet");

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
    const unauthorized_response = await requireMenuAccess("pengaturan-outlet");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = body?.action === "import_credentials"
      ? await importOutletCredentials({ rows: body?.rows })
      : body?.action === "update_exception"
      ? await updateOutletException({
          uuid_outlet: body?.uuid_outlet,
          excep: body?.excep,
        })
      : await updateOutlet({
          uuid_outlet: body?.uuid_outlet,
          name: body?.name,
          kategori: body?.kategori,
          is_skip_sync: body?.is_skip_sync,
          username: body?.username,
          password: body?.password,
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
