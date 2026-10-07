import { NextResponse } from "next/server";

import {
  dashboardku_sso_state_cookie_name,
  finishDashboardkuSsoLogin,
} from "@/services/dashboardkuSsoService";
import {
  createSessionToken,
  session_cookie_name,
  session_max_age,
} from "@/lib/session";
import { getPublicUrl } from "@/lib/url";

function redirect_to_login(request, message) {
  const login_url = getPublicUrl(request, "/login");

  login_url.searchParams.set("sso_error", message);

  return NextResponse.redirect(login_url);
}

export async function GET(request) {
  const state_token = request.cookies.get(dashboardku_sso_state_cookie_name)?.value;

  try {
    if (request.nextUrl.searchParams.get("error")) {
      throw new Error(
        request.nextUrl.searchParams.get("error_description") ||
          "Login SSO DashboardKU dibatalkan.",
      );
    }

    if (!state_token) {
      throw new Error("Sesi SSO tidak ditemukan.");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const { session_payload, return_to } = await finishDashboardkuSsoLogin({
      code,
      state,
      state_token,
    });
    const token = await createSessionToken(session_payload);
    const response = NextResponse.redirect(getPublicUrl(request, return_to));

    response.cookies.set(session_cookie_name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: session_max_age,
    });
    response.cookies.delete(dashboardku_sso_state_cookie_name);

    return response;
  } catch (error) {
    const response = redirect_to_login(
      request,
      error instanceof Error
        ? error.message
        : "Login SSO DashboardKU gagal.",
    );

    response.cookies.delete(dashboardku_sso_state_cookie_name);

    return response;
  }
}
