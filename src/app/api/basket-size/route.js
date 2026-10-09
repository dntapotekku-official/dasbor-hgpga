import { NextResponse } from "next/server";

import { import_outlet_report } from "@/app/api/_helpers/import-outlet-report";
import { requireMenuAccess } from "@/lib/auth";
import {
  bulkDeleteBasketSizeDate,
  bulkDeleteBasketSizeRange,
  bulkUpdateBasketSizeDate,
  bulkUpdateBasketSizeRange,
  deleteBasketSizeDaily,
  deleteBasketSizeRange,
  getNilaiTransaksiBasketSize,
  importBasketSize,
  updateBasketSizeSkuQty,
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
    const uuid_outlet = request.nextUrl.searchParams.get("uuid_outlet");
    const outlet_name = request.nextUrl.searchParams.get("outlet_name");
    const data = await getNilaiTransaksiBasketSize({
      selected_date,
      member_outlet_uuid: uuid_outlet,
      outlet_name,
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
  return import_outlet_report(request, {
    import_handler: importBasketSize,
    menu_key: "nilai-transaksi-basket-size",
    temp_prefix: "basket-size",
    fallback_roles: ["admin"],
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

    if (body?.action === "update_sku_qty") {
      const data = await updateBasketSizeSkuQty({
        uuid_outlet: body?.uuid_outlet,
        selected_date: body?.selected_date,
        sku_qty: body?.sku_qty,
        kunjungan: body?.kunjungan,
      });

      return NextResponse.json(data);
    }

    const data = body?.action === "bulk_update_monthly"
      ? await bulkUpdateBasketSizeRange({
          source_from_date: body?.source_from_date,
          source_to_date: body?.source_to_date,
          target_from_date: body?.target_from_date,
          target_to_date: body?.target_to_date,
        })
      : await bulkUpdateBasketSizeDate({
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
    const data = body?.action === "bulk_delete_monthly"
      ? await bulkDeleteBasketSizeRange({
          from_date: body?.from_date,
          to_date: body?.to_date,
        })
      : body?.action === "bulk_delete_date"
        ? await bulkDeleteBasketSizeDate({
          selected_date: body?.selected_date,
        })
        : body?.from_date && body?.to_date
          ? await deleteBasketSizeRange({
              uuid_outlet: body?.uuid_outlet,
              from_date: body?.from_date,
              to_date: body?.to_date,
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
