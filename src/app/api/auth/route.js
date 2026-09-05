import { NextResponse } from "next/server";
import authenticateUser from "@/services/authService";
import {
  createSessionToken,
  session_cookie_name,
  session_max_age,
} from "@/lib/session";

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const { session_payload } = await authenticateUser({
      username,
      password,
    });

    const token = await createSessionToken(session_payload);
    const response = NextResponse.json({
      success: true,
      data: session_payload,
    });

    response.cookies.set(session_cookie_name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: session_max_age,
    });

    return response;
  } catch (error) {
    const error_message = error instanceof Error
      ? error.message
      : "Terjadi kesalahan pada server.";
    const is_login_error = error_message === "Username atau kata sandi salah.";

    if (!is_login_error) {
      console.error("[POST /api/auth] Login error:", error);
    }

    return NextResponse.json(
      {
        success: false,
        message: is_login_error
          ? error_message
          : process.env.NODE_ENV !== "production" && error instanceof Error
            ? error_message
            : "Terjadi kesalahan pada server.",
      },
      { status: is_login_error ? 401 : 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Logout berhasil.",
  });

  response.cookies.delete(session_cookie_name);

  return response;
}
