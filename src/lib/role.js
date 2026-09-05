export function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

export const admin_account_roles = ["superadmin", "admin"];

const role_levels = {
  member: 0,
  admin: 1,
  superadmin: 2,
};

function getRoleLevel(role) {
  const normalized_role = normalizeRole(role);

  return Object.hasOwn(role_levels, normalized_role)
    ? role_levels[normalized_role]
    : -1;
}

export function hasRoleAccess(current_role, allowed_roles = []) {
  const current_role_level = getRoleLevel(current_role);

  if (current_role_level < 0) {
    return false;
  }

  return allowed_roles.some((allowed_role) => {
    const allowed_role_level = getRoleLevel(allowed_role);

    return allowed_role_level >= 0 && current_role_level >= allowed_role_level;
  });
}

export function isSuperadmin(role) {
  return normalizeRole(role) === "superadmin";
}

export function isAdminAccountRole(role) {
  return admin_account_roles.includes(normalizeRole(role));
}
