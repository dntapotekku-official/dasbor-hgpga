import { NextResponse } from "next/server";

import {
  createDashboardkuSsoStart,
  dashboardku_sso_state_cookie_name,
  dashboardku_sso_state_max_age,
} from "@/services/dashboardkuSsoService";

function redirect_to_login(request, message) {
  const login_url = new URL("/login", request.url);

  login_url.searchParams.set("sso_error", message);

  return NextResponse.redirect(login_url);
}

export async function GET(request) {
  try {
    const return_to = request.nextUrl.searchParams.get("return_to");
    const { authorization_url, state_token } = await createDashboardkuSsoStart({
      return_to,
    });
    const response = NextResponse.redirect(authorization_url);

    response.cookies.set(dashboardku_sso_state_cookie_name, state_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: dashboardku_sso_state_max_age,
    });

    return response;
  } catch (error) {
    return redirect_to_login(
      request,
      error instanceof Error
        ? error.message
        : "SSO DashboardKU tidak dapat dimulai.",
    );
  }
}
