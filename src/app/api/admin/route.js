import { NextResponse } from "next/server";
import getCurrentUser, { requireRole } from "@/lib/auth";
import {
  createAdmin,
  deleteAdmin,
  getAdmin,
  updateAdmin,
} from "@/services/adminService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

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
    const unauthorized_response = await requireRole(["admin"]);

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

export const PUT = async (request) => {
  try {
    const unauthorized_response = await requireRole(["admin"]);

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
    const unauthorized_response = await requireRole(["admin"]);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const current_user = await getCurrentUser();
    const data = await deleteAdmin({
      uuid_admin: body?.uuid_admin,
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
