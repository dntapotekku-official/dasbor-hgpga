const kepatuhan_sop_cctv_cache = new Map();

function buildCacheKey({ tanggal_awal, tanggal_akhir, uuid_outlet }) {
  return JSON.stringify({
    tanggal_awal: tanggal_awal ?? "",
    tanggal_akhir: tanggal_akhir ?? "",
    uuid_outlet: uuid_outlet ?? "",
  });
}

export function getKepatuhanSopCctvFromDb({
  tanggal_awal,
  tanggal_akhir,
  uuid_outlet,
} = {}) {
  const cache_key = buildCacheKey({
    tanggal_awal,
    tanggal_akhir,
    uuid_outlet,
  });

  if (kepatuhan_sop_cctv_cache.has(cache_key)) {
    return kepatuhan_sop_cctv_cache.get(cache_key);
  }

  const search_params = new URLSearchParams();

  if (tanggal_awal) {
    search_params.set("tanggal_awal", tanggal_awal);
  }

  if (tanggal_akhir) {
    search_params.set("tanggal_akhir", tanggal_akhir);
  }

  if (uuid_outlet) {
    search_params.set("uuid_outlet", uuid_outlet);
  }

  const request = fetch(`/api/kepatuhan-sop-cctv?${search_params.toString()}`, {
    method: "GET",
    cache: "no-store",
  })
    .then(async (response) => {
      const payload = await response.json();

      return {
        success: response.ok && payload.success,
        status: response.status,
        message: payload.message || "Data kepatuhan SOP CCTV belum tersedia.",
        data: payload.data,
      };
    })
    .catch((error) => {
      kepatuhan_sop_cctv_cache.delete(cache_key);
      throw error;
    });

  kepatuhan_sop_cctv_cache.set(cache_key, request);

  return request;
}

export function primeKepatuhanSopCctvCache(
  { tanggal_awal, tanggal_akhir, uuid_outlet } = {},
  value,
) {
  kepatuhan_sop_cctv_cache.set(
    buildCacheKey({ tanggal_awal, tanggal_akhir, uuid_outlet }),
    Promise.resolve(value),
  );
}

export function clearKepatuhanSopCctvCache() {
  kepatuhan_sop_cctv_cache.clear();
}
