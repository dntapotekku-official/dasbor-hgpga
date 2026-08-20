import { NextResponse } from "next/server";
import {
  getOutlet,
  syncOutlet,
  updateOutlet,
} from "@/services/outletService";
import { requireSession } from "@/lib/auth";

export const GET = async () => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getOutlet();

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
    const unauthorized_response = await requireSession();

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
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));

    console.log(body);
    const data = await updateOutlet({
      uuid_outlet: body?.uuid_outlet,
      name: body?.name,
      is_skip_sync: body?.is_skip_sync
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
