import { NextResponse } from "next/server";

import getCurrentUser, { requireSession } from "@/lib/auth";
import { updateOwnPassword } from "@/services/authService";

export async function PATCH(request) {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const current_user = await getCurrentUser();
    const body = await request.json().catch(() => ({}));
    const result = await updateOwnPassword({
      user_uuid: current_user?.uuid,
      user_role: current_user?.role,
      current_password: body?.current_password,
      new_password: body?.new_password,
      confirm_password: body?.confirm_password,
    });

    return NextResponse.json(result);
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
