import { NextResponse } from "next/server";

import { import_target_report } from "@/app/api/_helpers/import-target-report";
import { requireMenuAccess } from "@/lib/auth";
import {
  bulkDeleteTargetGofitku,
  bulkUpdateTargetGofitkuDates,
  createTargetGofitku,
  deleteTargetGofitku,
  getTargetGofitku,
  importTargetGofitku,
  updateTargetGofitku,
} from "@/services/penjualanGofitkuService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getTargetGofitku();

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
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createTargetGofitku({
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
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));

    if (body?.action === "bulk_update_dates") {
      const data = await bulkUpdateTargetGofitkuDates({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
        start_date: body?.start_date,
        end_date: body?.end_date,
      });

      return NextResponse.json(data);
    }

    const data = await updateTargetGofitku({
      uuid_target_gofitku: body?.uuid_target_gofitku,
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
    import_handler: importTargetGofitku,
    temp_prefix: "target-gofitku",
    field_names: ["start_date", "end_date"],
  });

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));

    if (body?.action === "bulk_delete_period") {
      const data = await bulkDeleteTargetGofitku({
        source_start_date: body?.source_start_date,
        source_end_date: body?.source_end_date,
      });

      return NextResponse.json(data);
    }

    const data = await deleteTargetGofitku({
      uuid_target_gofitku: body?.uuid_target_gofitku,
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
