import { NextResponse } from "next/server";
import { getCurrentUserFromToken } from "@/lib/auth";
import { canAccessMenu, getMenuKeyForPath } from "@/lib/menu-access";
import { session_cookie_name } from "@/lib/session";

const fallback_roles_by_menu = {
  dashboard: ["member"],
  "kepuasan-internal": [],
  "kepatuhan-sop-cctv": ["member"],
  "penjualan-gofitku": ["member"],
  "nilai-transaksi-basket-size": ["member"],
  "nilai-magang": [],
  "atribut-insanku": ["member"],
};

export async function proxy(request) {
  const token = request.cookies.get(session_cookie_name)?.value;
  const user_session = await getCurrentUserFromToken(token);

  if (!user_session) {
    const response = NextResponse.redirect(new URL("/login", request.url));

    response.cookies.delete(session_cookie_name);

    return response;
  }

  if (request.nextUrl.pathname === "/access-denied") {
    return NextResponse.next();
  }

  const menu_key = getMenuKeyForPath(request.nextUrl.pathname);
  const is_path_allowed =
    menu_key &&
    canAccessMenu(
      user_session,
      menu_key,
      fallback_roles_by_menu[menu_key] ?? [],
    );

  if (!is_path_allowed) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|login|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
