import { hasRoleAccess, isSuperadmin, normalizeRole } from "@/lib/role";

export const menu_access_options = [
  { value: "dashboard", label: "Dasbor", path: "/" },
  {
    value: "kepuasan-internal",
    label: "Kepuasan Internal",
    path: "/kepuasan-internal",
  },
  {
    value: "kepatuhan-sop-cctv",
    label: "Kepatuhan SOP CCTV",
    path: "/kepatuhan-sop-cctv",
  },
  {
    value: "penjualan-gofitku",
    label: "Penjualan GoFitKu",
    path: "/penjualan-gofitku",
  },
  {
    value: "nilai-transaksi-basket-size",
    label: "Nilai Transaksi & Basket Size",
    path: "/nilai-transaksi-basket-size",
  },
  { value: "nilai-magang", label: "Nilai Magang", path: "/nilai-magang" },
  {
    value: "atribut-insanku",
    label: "Atribut InsanKu",
    path: "/atribut-insanku",
  },
  {
    value: "pengaturan-pengguna",
    label: "Pengaturan Pengguna",
    path: "/pengaturan/pengguna",
  },
  {
    value: "pengaturan-outlet",
    label: "Pengaturan Outlet",
    path: "/pengaturan/outlet",
  },
  {
    value: "pengaturan-produk-gofitku",
    label: "Pengaturan Produk GoFitKu",
    path: "/pengaturan/produk-gofitku",
  },
  {
    value: "pengaturan-target",
    label: "Pengaturan Target",
    path: "/pengaturan/target",
  },
  {
    value: "pengaturan-atribut",
    label: "Pengaturan Atribut",
    path: "/pengaturan/atribut",
  },
  {
    value: "pengaturan-api-ai",
    label: "Pengaturan API AI",
    path: "/pengaturan/api-ai",
  },
  {
    value: "pengaturan-website-url",
    label: "Pengaturan URL Website",
    path: "/pengaturan/website-url",
  },
];

export const menu_access_keys = menu_access_options.map((item) => item.value);

const menu_by_path = [...menu_access_options].sort(
  (first, second) => second.path.length - first.path.length,
);

export function normalizeMenuAccessKeys(keys) {
  const valid_keys = new Set(menu_access_keys);

  return Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [])
        .map((key) => String(key ?? "").trim())
        .filter((key) => valid_keys.has(key)),
    ),
  );
}

export function getMenuKeyForPath(pathname) {
  const normalized_path = String(pathname ?? "").replace(/\/$/, "") || "/";

  if (
    normalized_path === "/penjualan-gofitku/target" ||
    normalized_path.startsWith("/penjualan-gofitku/target/")
  ) {
    return "pengaturan-target";
  }

  return menu_by_path.find((item) =>
    item.path === "/"
      ? normalized_path === "/"
      : normalized_path === item.path ||
        normalized_path.startsWith(`${item.path}/`),
  )?.value ?? null;
}

export function canAccessMenu(user, menu_key, fallback_roles = []) {
  const role = normalizeRole(user?.role);
  const menu_scope_keys = normalizeMenuAccessKeys(user?.menu_scope_keys);

  if (menu_scope_keys.length > 0 && !menu_scope_keys.includes(menu_key)) {
    return false;
  }

  if (isSuperadmin(role)) {
    return true;
  }

  if (menu_key === "dashboard" && (role === "admin" || role === "member")) {
    return true;
  }

  if (role === "admin") {
    return normalizeMenuAccessKeys(user?.menu_access_keys).includes(menu_key);
  }

  return hasRoleAccess(role, fallback_roles);
}

export function canAccessAnyMenu(user, menu_keys, fallback_roles = []) {
  return (Array.isArray(menu_keys) ? menu_keys : [menu_keys]).some((menu_key) =>
    canAccessMenu(user, menu_key, fallback_roles),
  );
}
