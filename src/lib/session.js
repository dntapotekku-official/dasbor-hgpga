import { SignJWT, jwtVerify } from "jose";
import { normalizeRole } from "@/lib/role";

export const session_cookie_name = "user_session";
export const session_max_age = 60 * 60 * 24;

function get_jwt_secret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET belum diatur.");
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
    };
  } catch {
    return null;
  }
}
