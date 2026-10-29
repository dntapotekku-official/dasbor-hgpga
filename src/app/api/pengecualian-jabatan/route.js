import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";
import { getJabatanGofitkuExclusions, saveJabatanGofitkuExclusions } from "@/services/jabatanGofitkuExclusionService";

export async function GET() {
  try {
    const unauthorized = await requireMenuAccess("pengaturan-pengguna");
    if (unauthorized) return unauthorized;
    return NextResponse.json({ success: true, data: await getJabatanGofitkuExclusions(prisma) });
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error), { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const unauthorized = await requireMenuAccess("pengaturan-pengguna");
    if (unauthorized) return unauthorized;
    const body = await request.json();
    return NextResponse.json(await saveJabatanGofitkuExclusions(prisma, body?.uuid_jabatan_master));
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error), { status: 400 });
  }
}
