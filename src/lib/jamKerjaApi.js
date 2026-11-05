import { NextResponse } from "next/server";
import getCurrentUser, { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";

/** Memeriksa sesi dan akses menu jam kerja sebelum menjalankan handler API. */
export async function handleJamKerjaRequest(action) {
  try {
    const denied = await requireMenuAccess("jam-kerja-insanku", ["member"]);
    if (denied) return denied;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    const result = await action({ uuid: user.uuid, role: user.role });
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error, "Gagal memproses kegiatan jam kerja."), { status: 400 });
  }
}
