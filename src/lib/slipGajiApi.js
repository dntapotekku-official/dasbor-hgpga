function trim_slashes(value) {
  return String(value ?? "").replace(/^\/+|\/+$/g, "");
}

export function buildSlipGajiApiUrl({
  legacy_env_name,
  path_env_name,
  fallback_path = "",
}) {
  const legacy_url = String(process.env[legacy_env_name] ?? "").trim();

  if (legacy_url) {
    return legacy_url;
  }

  const base_url = String(process.env.SLIP_GAJI_API_BASE_URL ?? "").trim();
  const path = String(process.env[path_env_name] ?? fallback_path).trim();

  if (!base_url) {
    throw new Error("Environment variable SLIP_GAJI_API_BASE_URL belum diatur.");
  }

  if (!path) {
    throw new Error(`Environment variable ${path_env_name} belum diatur.`);
  }

  return `${base_url.replace(/\/+$/g, "")}/${trim_slashes(path)}`;
}
