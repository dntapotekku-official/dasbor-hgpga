import { handleJamKerjaRequest } from "@/lib/jamKerjaApi";
import { getJamKerjaKegiatanPhoto } from "@/services/jamKerjaInsanKuService";

/** Memproses permintaan baca setelah memeriksa akses pengguna atau API key. */
export function GET(_request, context) {
  return handleJamKerjaRequest(async (access) => {
    const { uuid } = await context.params;
    const { bytes, mime } = await getJamKerjaKegiatanPhoto(uuid, access);
    return new Response(bytes, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
