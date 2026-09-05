import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hasRoleAccess,
  isAdminAccountRole,
  normalizeRole,
} from "@/lib/role";
import { canAccessAnyMenu } from "@/lib/menu-access";
import {
  session_cookie_name,
  verifySessionToken,
} from "@/lib/session";

export async function getCurrentUserFromToken(token) {
  const token_session = token ? await verifySessionToken(token) : null;

  if (!token_session?.uuid) {
    return null;
  }

  const token_role = normalizeRole(token_session.role);
  const is_admin_account = isAdminAccountRole(token_role);

  if (!is_admin_account && token_role !== "member") {
    return null;
  }

  const user = is_admin_account
    ? await prisma.tbl_admin.findFirst({
        where: {
          uuid: token_session.uuid,
          deleted_at: null,
        },
        select: {
          uuid: true,
          username: true,
          name: true,
          role: true,
          admin_menu_access: {
            where: { deleted_at: null },
            select: { key: true },
          },
        },
      })
    : await prisma.tbl_insanku.findFirst({
        where: {
          uuid: token_session.uuid,
          deleted_at: null,
        },
        select: {
          uuid: true,
          username: true,
          name: true,
          role: true,
        },
      });

  if (!user) {
    return null;
  }

  return {
    uuid: user.uuid,
    username: user.username,
    name: user.name,
    role: is_admin_account ? normalizeRole(user.role) : "member",
    menu_access_keys: is_admin_account
      ? user.admin_menu_access.map((item) => item.key)
      : [],
  };
}

export default async function getCurrentUser() {
  const cookie_store = await cookies();
  const token = cookie_store.get(session_cookie_name)?.value;

  if (!token) {
    return null;
  }

  return getCurrentUserFromToken(token);
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

export async function requireMenuAccess(menu_keys, fallback_roles = []) {
  const user_session = await getCurrentUser();

  if (!user_session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  if (!canAccessAnyMenu(user_session, menu_keys, fallback_roles)) {
    return NextResponse.json(
      { success: false, message: "Tidak Memiliki Akses." },
      { status: 403 },
    );
  }

  return null;
}
