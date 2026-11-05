import { NextResponse } from "next/server";
import getCurrentUser, { requireMenuAccess } from "@/lib/auth";
import { buildApiErrorResponse } from "@/lib/api-error";
import { getJamKerjaInsanKu, updateJamKerjaInsanKu, deleteJamKerjaInsanKu } from "@/services/jamKerjaInsanKuService";

/** Memeriksa hak akses menu sebelum menjalankan operasi rekap jam kerja. */
async function handle_request(action) {
  try {
    const denied = await requireMenuAccess("jam-kerja-insanku", ["member"]);

    if (denied) return denied;

    const user = await getCurrentUser();

    if (!user) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

    return NextResponse.json(await action({ uuid: user.uuid, role: user.role }));
  } catch (error) {
    return NextResponse.json(buildApiErrorResponse(error, "Gagal memproses jam kerja InsanKU."), { status: 500 });
  }
}

/** Memproses permintaan baca setelah memeriksa akses pengguna atau API key. */
export function GET(request) {
  const params = new URL(request.url).searchParams;

  return handle_request((access) => getJamKerjaInsanKu(access, {
    month: params.get("month"), year: params.get("year"),
  }));
}

/** Memproses perubahan data setelah memeriksa akses dan payload permintaan. */
export function PATCH(request) {
  return handle_request(async (access) => updateJamKerjaInsanKu(await request.json(), access));
}

/** Memproses penghapusan data yang dapat diakses pengguna. */
export function DELETE(request) {
  return handle_request(async (access) => deleteJamKerjaInsanKu(await request.json(), access));
}
