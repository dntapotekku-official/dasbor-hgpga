import { NextResponse } from "next/server";
import authenticateUser from "@/services/authService";

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const { session_payload } = await authenticateUser({
      username,
      password,
    });

    const response = NextResponse.json({
      success: true,
      data: session_payload,
    });

    response.cookies.set("user_session", JSON.stringify(session_payload), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    const is_login_error = error.message === "Username atau kata sandi salah.";

    return NextResponse.json(
      {
        success: false,
        message: is_login_error
          ? error.message
          : "Terjadi kesalahan pada server.",
      },
      { status: is_login_error ? 401 : 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Logout berhasil.",
  });

  response.cookies.delete("user_session");

  return response;
}
