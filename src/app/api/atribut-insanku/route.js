import { NextResponse } from "next/server";

import getCurrentUser, { requireRole, requireSession } from "@/lib/auth";
import {
  getAtributInsanku,
  updateAtributKaryawan,
} from "@/services/atributInsankuService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["member"]);

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
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const user_session = await getCurrentUser();
    const body = await request.json().catch(() => ({}));
    const data = await updateAtributKaryawan({
      uuid_karyawan: body?.uuid_karyawan,
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
