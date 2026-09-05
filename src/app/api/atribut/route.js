import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";
import {
  createAtribut,
  deleteAtribut,
  getAtributMaster,
  reorderAtribut,
  updateAtribut,
} from "@/services/atributInsanKuService";

export const GET = async () => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-atribut");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getAtributMaster();

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

export const PUT = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-atribut");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await createAtribut({
      name: body?.name,
      type: body?.type,
      is_view: body?.is_view,
      is_edit: body?.is_edit,
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

export const POST = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-atribut");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await reorderAtribut({
      ordered_uuids: body?.ordered_uuids,
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

export const PATCH = async (request) => {
  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-atribut");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await updateAtribut({
      uuid_atribut: body?.uuid_atribut,
      name: body?.name,
      type: body?.type,
      is_view: body?.is_view,
      is_edit: body?.is_edit,
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
    const unauthorized_response = await requireMenuAccess("pengaturan-atribut");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const body = await request.json().catch(() => ({}));
    const data = await deleteAtribut({
      uuid_atribut: body?.uuid_atribut,
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
