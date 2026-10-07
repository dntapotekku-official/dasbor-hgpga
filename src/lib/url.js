export function getPublicOrigin(request) {
  const configured_origin = String(
    process.env.APP_PUBLIC_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.PUBLIC_APP_URL ??
      "",
  ).trim();

  if (configured_origin) {
    return configured_origin.replace(/\/+$/, "");
  }

  const forwarded_host = request.headers.get("x-forwarded-host");
  const forwarded_proto = request.headers.get("x-forwarded-proto") || "https";

  if (forwarded_host) {
    return `${forwarded_proto}://${forwarded_host}`;
  }

  return new URL(request.url).origin;
}

export function getPublicUrl(request, path) {
  return new URL(path, getPublicOrigin(request));
}
