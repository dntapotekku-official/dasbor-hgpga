import { NextResponse } from "next/server";
import getCurrentUser, { requireRole } from "@/lib/auth";
import {
  createSessionToken,
  session_cookie_name,
  session_max_age,
} from "@/lib/session";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  updateAdmin,
} from "@/services/adminService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["superadmin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getAdmin();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireRole(["superadmin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const current_user = await getCurrentUser();
    const data = await updateAdmin({
      uuid_admin: body?.uuid_admin,
      name: body?.name,
      username: body?.username,
      role: body?.role,
      menu_access_keys: body?.menu_access_keys,
      actor_role: current_user?.role,
    });

    const response = NextResponse.json(data);

    if (current_user?.uuid === data.data?.uuid) {
      const session_payload = {
        uuid: data.data.uuid,
        username: data.data.username,
        name: data.data.name,
        role: data.data.role,
      };
      const token = await createSessionToken(session_payload);

      response.cookies.set(session_cookie_name, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: session_max_age,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const PUT = async (request) => {
  try {
    const unauthorized_response = await requireRole(["superadmin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const current_user = await getCurrentUser();
    const data = await createAdmin({
      name: body?.name,
      username: body?.username,
      password: body?.password,
      role: body?.role,
      menu_access_keys: body?.menu_access_keys,
      actor_role: current_user?.role,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};

export const DELETE = async (request) => {
  try {
    const unauthorized_response = await requireRole(["superadmin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const current_user = await getCurrentUser();
    const data = await deleteAdmin({
      uuid_admin: body?.uuid_admin,
      actor_role: current_user?.role,
    });

    const response = NextResponse.json(data);

    if (current_user?.uuid === body?.uuid_admin) {
      response.cookies.delete(session_cookie_name);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
};
