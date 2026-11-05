import { handleJamKerjaRequest } from "@/lib/jamKerjaApi";
import { createJamKerjaKegiatan, getJamKerjaKegiatan, updateJamKerjaKegiatan, deleteJamKerjaKegiatan } from "@/services/jamKerjaInsanKuService";

/** Memproses permintaan baca setelah memeriksa akses pengguna atau API key. */
export function GET(request) {
  const params = new URL(request.url).searchParams;
  return handleJamKerjaRequest((access) => getJamKerjaKegiatan(Object.fromEntries(params), access));
}

/** Memproses permintaan penambahan atau sinkronisasi sesuai fitur API. */
export function POST(request) {
  return handleJamKerjaRequest(async (access) => {
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
    const form = await request.formData();
    return createJamKerjaKegiatan(Object.fromEntries(["id", "month", "year", "date", "description", "hours_value"].map((key) => [key, form.get(key)])), form.get("photo"), access);
  });
}


/** Memproses perubahan data setelah memeriksa akses dan payload permintaan. */
export function PATCH(request) {
  return handleJamKerjaRequest(async (access) => {
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
    const form = await request.formData();
    return updateJamKerjaKegiatan(Object.fromEntries(["uuid", "id", "month", "year", "date", "description", "hours_value"].map((key) => [key, form.get(key)])), form.get("photo"), access);
  });
}

/** Memproses penghapusan data yang dapat diakses pengguna. */
export function DELETE(request) {
  return handleJamKerjaRequest(async (access) => deleteJamKerjaKegiatan(await request.json(), access));
}
