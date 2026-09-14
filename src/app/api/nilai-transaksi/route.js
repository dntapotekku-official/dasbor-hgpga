import { NextResponse } from "next/server";

import { import_outlet_report } from "@/app/api/_helpers/import-outlet-report";
import { requireMenuAccess } from "@/lib/auth";
import {
  bulkDeleteNilaiTransaksiDate,
  bulkUpdateNilaiTransaksiDate,
  deleteNilaiTransaksiDaily,
  exportNilaiTransaksiBasketSizeWorkbook,
  getNilaiTransaksiBasketSize,
  importNilaiTransaksi,
  updateNilaiTransaksiDaily,
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
    const action = request.nextUrl.searchParams.get("action");

    if (action === "export") {
      const unauthorized_export_response = await requireMenuAccess(
        "nilai-transaksi-basket-size",
        ["admin"],
      );

      if (unauthorized_export_response) {
        return unauthorized_export_response;
      }

      const { buffer, filename } = await exportNilaiTransaksiBasketSizeWorkbook({
        selected_date,
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }

    const data = await getNilaiTransaksiBasketSize({
      selected_date,
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
    import_handler: importNilaiTransaksi,
    menu_key: "nilai-transaksi-basket-size",
    temp_prefix: "nilai-transaksi",
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

    if (body?.action === "bulk_update_date") {
      const data = await bulkUpdateNilaiTransaksiDate({
        source_date: body?.source_date,
        target_date: body?.target_date,
      });

      return NextResponse.json(data);
    }

    const data = await updateNilaiTransaksiDaily({
      uuid_outlet: body?.uuid_outlet,
      selected_date: body?.selected_date,
      total_revenue: body?.total_revenue,
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
      ? await bulkDeleteNilaiTransaksiDate({
          selected_date: body?.selected_date,
        })
      : await deleteNilaiTransaksiDaily({
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
