import { NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";
import {
  getNtBsSummaryExclusions, saveNtBsSummaryExclusions, updateNtBsSummaryExclusion, removeNtBsSummaryExclusion,
} from "@/services/ntBsSummaryExclusionService";

async function handle(action) {
  const unauthorized = await requireMenuAccess("pengaturan-pengecualian");
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ success: true, ...await action() });
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error), { status: error.status === 409 ? 409 : 400 });
  }
}

export async function GET() {
  return handle(async () => ({ data: await getNtBsSummaryExclusions() }));
}

export async function POST(request) {
  return handle(async () => {
    await saveNtBsSummaryExclusions(await request.json());
    return { message: "Pengecualian total disimpan." };
  });
}

export async function DELETE(request) {
  return handle(async () => {
    const { uuid } = await request.json();
    await removeNtBsSummaryExclusion(uuid);
    return { message: "Outlet kembali disertakan dalam total pada periode tersebut." };
  });
}

export async function PATCH(request) {
  return handle(async () => {
    await updateNtBsSummaryExclusion(await request.json());
    return { message: "Pengecualian total diperbarui." };
  });
}
