import { SignJWT, jwtVerify } from "jose";
import { normalizeMenuAccessKeys } from "@/lib/menu-access";
import { normalizeRole } from "@/lib/role";

export const session_cookie_name = "user_session";
export const session_max_age = 60 * 60 * 24;

function get_jwt_secret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET belum diatur.");
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JWT_SECRET untuk production minimal 32 karakter.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(get_jwt_secret());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, get_jwt_secret());

    return {
      uuid: payload.uuid,
      username: payload.username,
      name: payload.name,
      role: normalizeRole(payload.role),
      auth_source: payload.auth_source,
      dashboard_return_to: payload.dashboard_return_to,
      menu_scope_keys: normalizeMenuAccessKeys(payload.menu_scope_keys),
    };
  } catch {
    return null;
  }
}
