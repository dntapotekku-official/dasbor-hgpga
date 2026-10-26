import { NextResponse } from "next/server";
import { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";
import { getPlacementMapping } from "@/services/placementMappingService";

export async function GET(request) {
  try {
    const unauthorized = await requireMenuAccess("pengaturan-pengguna");
    if (unauthorized) return unauthorized;
    const requested_year = new URL(request.url).searchParams.get("year");
    const data = await getPlacementMapping(requested_year);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error), {
      status: error instanceof RangeError ? 400 : 500,
    });
  }
}
