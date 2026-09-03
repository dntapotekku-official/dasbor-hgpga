import { NextResponse } from "next/server";

import { import_target_report } from "@/app/api/_helpers/import-target-report";
import { requireRole } from "@/lib/auth";
import {
  bulkDeleteTargetNilaiTransaksi,
  bulkUpdateTargetNilaiTransaksiDates,
  createTargetNilaiTransaksi,
  deleteTargetNilaiTransaksi,
  getTargetNilaiTransaksi,
  importTargetNilaiTransaksi,
  updateTargetNilaiTransaksi,
} from "@/services/nilaiTransaksiBasketSizeService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getTargetNilaiTransaksi();

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

export const PUT = async (request) => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createTargetNilaiTransaksi({
      uuid_outlet: body?.uuid_outlet,
      start_date: body?.start_date,
      end_date: body?.end_date,
      target: body?.target,
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

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));

    if (body?.action === "bulk_update_dates") {
      const data = await bulkUpdateTargetNilaiTransaksiDates({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
        start_date: body?.start_date,
        end_date: body?.end_date,
      });

      return NextResponse.json(data);
    }

    const data = await updateTargetNilaiTransaksi({
      uuid_target_metric: body?.uuid_target_metric,
      uuid_outlet: body?.uuid_outlet,
      start_date: body?.start_date,
      end_date: body?.end_date,
      target: body?.target,
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

export const POST = (request) =>
  import_target_report(request, {
    import_handler: importTargetNilaiTransaksi,
    temp_prefix: "target-nilai-transaksi",
    field_names: ["import_date"],
  });

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));

    if (body?.action === "bulk_delete_period") {
      const data = await bulkDeleteTargetNilaiTransaksi({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
      });

      return NextResponse.json(data);
    }

    const data = await deleteTargetNilaiTransaksi({
      uuid_target_metric: body?.uuid_target_metric,
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
