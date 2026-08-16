import { NextResponse } from "next/server";

export function proxy(request) {
  const user_session = request.cookies.get("user_session")?.value;

  if (!user_session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
