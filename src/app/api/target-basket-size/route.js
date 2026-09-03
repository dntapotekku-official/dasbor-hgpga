import { NextResponse } from "next/server";

import { import_target_report } from "@/app/api/_helpers/import-target-report";
import { requireRole } from "@/lib/auth";
import {
  bulkDeleteTargetBasketSize,
  bulkUpdateTargetBasketSizeDates,
  createTargetBasketSize,
  deleteTargetBasketSize,
  getTargetBasketSize,
  importTargetBasketSize,
  updateTargetBasketSize,
} from "@/services/nilaiTransaksiBasketSizeService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getTargetBasketSize();

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
    const data = await createTargetBasketSize({
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
      const data = await bulkUpdateTargetBasketSizeDates({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
        start_date: body?.start_date,
        end_date: body?.end_date,
      });

      return NextResponse.json(data);
    }

    const data = await updateTargetBasketSize({
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
    import_handler: importTargetBasketSize,
    temp_prefix: "target-basket-size",
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
      const data = await bulkDeleteTargetBasketSize({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
      });

      return NextResponse.json(data);
    }

    const data = await deleteTargetBasketSize({
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
