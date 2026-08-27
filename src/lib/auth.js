import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasRoleAccess } from "@/lib/role";
import {
  session_cookie_name,
  verifySessionToken,
} from "@/lib/session";

export default async function getCurrentUser() {
  const cookie_store = await cookies();
  const token = cookie_store.get(session_cookie_name)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession() {
  const user_session = await getCurrentUser();

  if (!user_session) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  return null;
}

export async function requireRole(allowed_roles = []) {
  const user_session = await getCurrentUser();

  if (!user_session) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  if (!hasRoleAccess(user_session.role, allowed_roles)) {
    return NextResponse.json(
      {
        success: false,
        message: "Tidak Memiliki Akses.",
      },
      { status: 404 },
    );
  }

  return null;
}
