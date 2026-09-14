import { NextResponse } from "next/server";

import getCurrentUser, { requireMenuAccess } from "@/lib/auth";
import {
  getAtributInsanku,
  syncAtributInsanKuData,
  importAtributInsanKu,
  syncAtributInsanKuByNik,
  updateAtributInsanKu,
} from "@/services/atributInsanKuService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "atribut-insanku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const data = await getAtributInsanku({
      user_uuid: user_session?.uuid,
      user_role: user_session?.role,
    });

    return NextResponse.json({
      success: true,
      data,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "atribut-insanku",
      ["member"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const body = await request.json().catch(() => ({}));
    if (body?.operation === "sync-data") {
      const data = await syncAtributInsanKuData({
        actor_role: user_session?.role,
      });

      return NextResponse.json(data);
    }

    if (body?.operation === "sync-by-nik") {
      const unauthorized_sync_response = await requireMenuAccess(
        "atribut-insanku",
        ["admin"],
      );

      if (unauthorized_sync_response) {
        return unauthorized_sync_response;
      }

      const data = await syncAtributInsanKuByNik({
        actor_role: user_session?.role,
      });

      return NextResponse.json(data);
    }

    const data = await updateAtributInsanKu({
      uuid_insanku: body?.uuid_insanku,
      uuid_atribut: body?.uuid_atribut,
      value: body?.value,
      actor_uuid: user_session?.uuid,
      actor_role: user_session?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess(
      "atribut-insanku",
      ["admin"],
    );

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const body = await request.json().catch(() => ({}));
    const data = await importAtributInsanKu({
      rows: body?.rows,
      active_tab: body?.active_tab,
      active_category: body?.active_category,
      actor_role: user_session?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};
