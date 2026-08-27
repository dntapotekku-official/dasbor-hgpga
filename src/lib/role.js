export function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

const role_levels = {
  member: 0,
  viewer: 1,
  admin: 2,
  superadmin: 3,
};

export function getRoleLevel(role) {
  const normalized_role = normalizeRole(role);

  return Object.hasOwn(role_levels, normalized_role)
    ? role_levels[normalized_role]
    : role_levels.member;
}

export function hasRoleAccess(current_role, allowed_roles = []) {
  const current_role_level = getRoleLevel(current_role);

  return allowed_roles.some(
    (allowed_role) => current_role_level >= getRoleLevel(allowed_role),
  );
}

export function isSuperadmin(role) {
  return normalizeRole(role) === "superadmin";
}
