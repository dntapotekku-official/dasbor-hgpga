const kepuasan_internal_cache = new Map();

function build_cache_key({ year } = {}) {
  return JSON.stringify({ year: year ?? "" });
}

export function get_kepuasan_internal_from_db({ year } = {}) {
  const cache_key = build_cache_key({ year });

  if (kepuasan_internal_cache.has(cache_key)) {
    return kepuasan_internal_cache.get(cache_key);
  }

  const search_params = new URLSearchParams();

  if (year) {
    search_params.set("year", year);
  }

  const query = search_params.toString();
  const request = fetch(
    `/api/kepuasan-internal${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      const payload = await response.json();

      return {
        success: response.ok && payload.success,
        status: response.status,
        message: payload.message || "Data kepuasan internal belum tersedia.",
        data: payload.data,
      };
    })
    .catch((error) => {
      kepuasan_internal_cache.delete(cache_key);
      throw error;
    });

  kepuasan_internal_cache.set(cache_key, request);

  return request;
}

export function clear_kepuasan_internal_cache() {
  kepuasan_internal_cache.clear();
}
