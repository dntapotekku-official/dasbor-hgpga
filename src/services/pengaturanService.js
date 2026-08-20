import { syncOutlet } from "@/services/outletService";
import { syncKaryawan } from "@/services/karyawanService";
import { syncOutletKaryawan } from "@/services/outletKaryawanService";

export async function syncMain() {
  const outlet_result = await syncOutlet();
  const karyawan_result = await syncKaryawan();
  const outlet_karyawan_result = await syncOutletKaryawan();

  return {
    success: true,
    data: {
      ...outlet_result.data,
      ...karyawan_result.data,
      ...outlet_karyawan_result.data,
    },
    summary: {
      ...outlet_result.summary,
      ...karyawan_result.summary,
      ...outlet_karyawan_result.summary,
    },
  };
}
