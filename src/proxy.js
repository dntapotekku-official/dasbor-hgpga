import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/role";
import {
  verifySessionToken,
  session_cookie_name,
} from "@/lib/session";

const role_allowed_paths = {
  superadmin: null,
  admin: null,
  viewer: [
    "/",
    "/kepuasan-internal",
    "/kepatuhan-sop-cctv",
    "/penjualan-gofitku",
    "/nilai-transaksi-basket-size",
    "/nilai-transaksi",
    "/nilai-magang",
    "/atribut-insanku",
  ],
  member: ["/", "/penjualan-gofitku"],
};

export async function proxy(request) {
  const token = request.cookies.get(session_cookie_name)?.value;
  const user_session = token ? await verifySessionToken(token) : null;

  if (!user_session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const normalized_role = normalizeRole(user_session.role);
  const allowed_paths = Object.hasOwn(role_allowed_paths, normalized_role)
    ? role_allowed_paths[normalized_role]
    : role_allowed_paths.member;
  const is_path_allowed =
    allowed_paths === null ||
    allowed_paths.some((path) =>
      path === "/"
        ? request.nextUrl.pathname === "/"
        : request.nextUrl.pathname === path ||
          request.nextUrl.pathname.startsWith(`${path}/`),
    );

  if (!is_path_allowed) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|login|_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
