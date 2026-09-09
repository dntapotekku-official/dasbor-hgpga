import { NextResponse } from "next/server";

import { import_outlet_report } from "@/app/api/_helpers/import-outlet-report";
import getCurrentUser, { requireMenuAccess } from "@/lib/auth";
import {
  bulkDeleteBasketSizeDate,
  bulkUpdateBasketSizeDate,
  deleteBasketSizeDaily,
  getNilaiTransaksiBasketSize,
  importBasketSize,
} from "@/services/nilaiTransaksiBasketSizeService";

export async function GET(request) {
  try {
    const unauthorized_response = await requireMenuAccess(
      "nilai-transaksi-basket-size",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const selected_date = request.nextUrl.searchParams.get("selected_date");
    const user_session = await getCurrentUser();
    const data = await getNilaiTransaksiBasketSize({
      selected_date,
      member_outlet_uuid:
        user_session?.role === "member" ? user_session.uuid : undefined,
    });

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

export async function POST(request) {
  const user_session = await getCurrentUser();

  return import_outlet_report(request, {
    import_handler: importBasketSize,
    menu_key: "nilai-transaksi-basket-size",
    temp_prefix: "basket-size",
    fallback_roles: ["member"],
    handler_payload: {
      member_outlet_uuid:
        user_session?.role === "member" ? user_session.uuid : undefined,
    },
  });
}

export async function PATCH(request) {
  try {
    const unauthorized_response = await requireMenuAccess(
      "nilai-transaksi-basket-size",
      ["admin"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await bulkUpdateBasketSizeDate({
      source_date: body?.source_date,
      target_date: body?.target_date,
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
    const unauthorized_response = await requireMenuAccess(
      "nilai-transaksi-basket-size",
      ["admin"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = body?.action === "bulk_delete_date"
      ? await bulkDeleteBasketSizeDate({
          selected_date: body?.selected_date,
        })
      : await deleteBasketSizeDaily({
          uuid_outlet: body?.uuid_outlet,
          selected_date: body?.selected_date,
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
