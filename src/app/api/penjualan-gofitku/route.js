import { NextResponse } from "next/server";

import getCurrentUser, { requireMenuAccess } from "@/lib/auth";
import {
  createPenjualanGofitku,
  deletePenjualanGofitku,
  getPenjualanGofitkuExport,
  getPenjualanGofitku,
  getPenjualanGofitkuTopOutletChart,
  getPenjualanGofitkuTopProdukChart,
  updatePenjualanGofitku,
} from "@/services/penjualanGofitkuService";

function error_response(error) {
  return NextResponse.json(
    {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada server.",
    },
    { status: 500 },
  );
}

export const GET = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "penjualan-gofitku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const is_export = searchParams.get("export") === "true";
    const is_outlet_chart = searchParams.get("outlet_chart") === "true";
    const is_product_chart = searchParams.get("product_chart") === "true";
    const user_context = {
      account_uuid: user_session?.uuid,
      role: user_session?.role,
    };
    let data;

    if (is_export) {
      data = await getPenjualanGofitkuExport(user_context);
    } else if (is_outlet_chart) {
      data = await getPenjualanGofitkuTopOutletChart(user_context);
    } else if (is_product_chart) {
      data = await getPenjualanGofitkuTopProdukChart(user_context);
    } else {
      data = await getPenjualanGofitku({
        ...user_context,
        date: searchParams.get("date"),
        outlet_uuid: searchParams.get("outlet_uuid"),
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return error_response(error);
  }
};

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "penjualan-gofitku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const user_session = await getCurrentUser();
    const data = await createPenjualanGofitku({
      outlet_uuid: body?.outlet_uuid,
      entries: body?.entries,
      account_uuid: user_session?.uuid,
      role: user_session?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return error_response(error);
  }
};

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "penjualan-gofitku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const user_session = await getCurrentUser();
    const data = await updatePenjualanGofitku({
      uuid_penjualan_gofitku: body?.uuid_penjualan_gofitku,
      outlet_uuid: body?.outlet_uuid,
      employee_uuid: body?.employee_uuid,
      produk_uuid: body?.produk_uuid,
      product_name: body?.product_name,
      date: body?.date,
      sales_total: body?.sales_total,
      account_uuid: user_session?.uuid,
      role: user_session?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return error_response(error);
  }
};

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "penjualan-gofitku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const user_session = await getCurrentUser();
    const data = await deletePenjualanGofitku({
      uuid_penjualan_gofitku: body?.uuid_penjualan_gofitku,
      outlet_uuid: body?.outlet_uuid,
      account_uuid: user_session?.uuid,
      role: user_session?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return error_response(error);
  }
};
