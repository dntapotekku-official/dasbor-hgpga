import { NextResponse } from "next/server";
import { syncOutletKaryawan, getOutletKaryawan } from "@/services/outletKaryawanService";
import { requireSession } from "@/lib/auth";

export const POST = async () => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await syncOutletKaryawan();

    if (!data?.success || !data.summary) {
      throw new Error("Format data outlet-karyawan tidak valid.");
    }

    return NextResponse.json({
      success: true,
      data: data.data
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}

export const GET = async () => {
  try {
    const unauthorized_response = await requireSession();

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const data = await getOutletKaryawan();

    return NextResponse.json({
      success: true,
      data: data
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
