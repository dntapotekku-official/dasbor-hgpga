import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

import { normalizeMenuAccessKeys } from "@/lib/menu-access";
import { prisma } from "@/lib/prisma";

export const dashboardku_sso_state_cookie_name = "dashboardku_sso_state";
export const dashboardku_sso_state_max_age = 10 * 60;

const discovery_cache = {
  issuer: "",
  metadata: null,
  jwks: null,
};

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function get_required_env(name) {
  const value = String(process.env[name] ?? "").trim();

  if (!value) {
    throw new Error(`${name} belum dikonfigurasi.`);
  }

  return value;
}

function get_jwt_secret() {
  const secret = get_required_env("JWT_SECRET");

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JWT_SECRET untuk production minimal 32 karakter.");
  }

  return new TextEncoder().encode(secret);
}

function get_issuer() {
  return get_required_env("DASHBOARDKU_OIDC_ISSUER").replace(/\/+$/, "");
}

function get_client_id() {
  return get_required_env("DASHBOARDKU_OIDC_CLIENT_ID");
}

function get_client_secret() {
  return String(process.env.DASHBOARDKU_OIDC_CLIENT_SECRET ?? "").trim();
}

function get_redirect_uri() {
  return get_required_env("DASHBOARDKU_OIDC_REDIRECT_URI");
}

function get_scope() {
  return String(process.env.DASHBOARDKU_OIDC_SCOPE ?? "openid profile email").trim();
}

function get_post_login_redirect() {
  const configured_path = String(
    process.env.DASHBOARDKU_OIDC_POST_LOGIN_REDIRECT ?? "/penjualan-gofitku",
  ).trim();

  return configured_path.startsWith("/") ? configured_path : "/penjualan-gofitku";
}

function get_allowed_redirects() {
  const configured_redirects = String(
    process.env.DASHBOARDKU_OIDC_ALLOWED_REDIRECTS ?? "/,/penjualan-gofitku",
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.startsWith("/"));

  return new Set(configured_redirects.length ? configured_redirects : ["/", "/penjualan-gofitku"]);
}

export function resolveDashboardkuSsoRedirect(path) {
  const normalized_path = String(path ?? "").trim();
  const fallback_path = get_post_login_redirect();

  if (!normalized_path || !normalized_path.startsWith("/")) {
    return fallback_path;
  }

  return get_allowed_redirects().has(normalized_path)
    ? normalized_path
    : fallback_path;
}

export function resolveDashboardkuMenuScope(scope) {
  const raw_scopes = String(scope ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const menu_scope_keys = normalizeMenuAccessKeys(raw_scopes);

  if (raw_scopes.length > 0 && menu_scope_keys.length === 0) {
    throw new Error("Scope menu SSO DashboardKU tidak valid.");
  }

  return menu_scope_keys;
}

function resolve_endpoint(metadata, key, env_name, fallback_path) {
  const configured_url = String(process.env[env_name] ?? "").trim();

  if (configured_url) {
    return configured_url;
  }

  if (metadata?.[key]) {
    return metadata[key];
  }

  return `${get_issuer()}${fallback_path}`;
}

async function get_openid_configuration() {
  const issuer = get_issuer();

  if (discovery_cache.issuer === issuer && discovery_cache.metadata) {
    return discovery_cache.metadata;
  }

  const discovery_url = String(
    process.env.DASHBOARDKU_OIDC_DISCOVERY_URL ??
      `${issuer}/.well-known/openid-configuration`,
  ).trim();
  const response = await fetch(discovery_url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Gagal mengambil konfigurasi OIDC DashboardKU.");
  }

  const metadata = await response.json();

  discovery_cache.issuer = issuer;
  discovery_cache.metadata = metadata;
  discovery_cache.jwks = null;

  return metadata;
}

async function get_jwks(metadata) {
  const jwks_uri = resolve_endpoint(
    metadata,
    "jwks_uri",
    "DASHBOARDKU_OIDC_JWKS_URI",
    "/.well-known/jwks.json",
  );

  if (!discovery_cache.jwks || discovery_cache.jwks_uri !== jwks_uri) {
    discovery_cache.jwks = createRemoteJWKSet(new URL(jwks_uri));
    discovery_cache.jwks_uri = jwks_uri;
  }

  return discovery_cache.jwks;
}

function create_code_verifier() {
  return base64url(randomBytes(32));
}

function create_code_challenge(code_verifier) {
  return base64url(createHash("sha256").update(code_verifier).digest());
}

export async function createDashboardkuSsoStart({ return_to, menu_scope } = {}) {
  const metadata = await get_openid_configuration();
  const code_verifier = create_code_verifier();
  const authorization_endpoint = resolve_endpoint(
    metadata,
    "authorization_endpoint",
    "DASHBOARDKU_OIDC_AUTHORIZATION_ENDPOINT",
    "/oauth/authorize",
  );
  const state_payload = {
    state: base64url(randomBytes(32)),
    nonce: base64url(randomBytes(32)),
    code_verifier,
    return_to: resolveDashboardkuSsoRedirect(return_to),
    menu_scope_keys: resolveDashboardkuMenuScope(menu_scope),
  };
  const state_token = await new SignJWT(state_payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dashboardku_sso_state_max_age}s`)
    .setJti(randomUUID())
    .sign(get_jwt_secret());
  const authorization_url = new URL(authorization_endpoint);

  authorization_url.searchParams.set("response_type", "code");
  authorization_url.searchParams.set("client_id", get_client_id());
  authorization_url.searchParams.set("redirect_uri", get_redirect_uri());
  authorization_url.searchParams.set("scope", get_scope());
  authorization_url.searchParams.set("state", state_payload.state);
  authorization_url.searchParams.set("nonce", state_payload.nonce);
  authorization_url.searchParams.set("code_challenge", create_code_challenge(code_verifier));
  authorization_url.searchParams.set("code_challenge_method", "S256");

  return {
    authorization_url,
    state_token,
  };
}

export async function verifyDashboardkuSsoState(state_token) {
  try {
    const { payload } = await jwtVerify(state_token, get_jwt_secret());

    return {
      state: payload.state,
      nonce: payload.nonce,
      code_verifier: payload.code_verifier,
      return_to: resolveDashboardkuSsoRedirect(payload.return_to),
      menu_scope_keys: normalizeMenuAccessKeys(payload.menu_scope_keys),
    };
  } catch {
    throw new Error("Sesi SSO tidak valid atau sudah kedaluwarsa.");
  }
}

async function exchange_code_for_tokens({ code, code_verifier, metadata }) {
  const token_endpoint = resolve_endpoint(
    metadata,
    "token_endpoint",
    "DASHBOARDKU_OIDC_TOKEN_ENDPOINT",
    "/oauth/token",
  );
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: get_redirect_uri(),
    client_id: get_client_id(),
    code_verifier,
  });
  const client_secret = get_client_secret();

  if (client_secret) {
    body.set("client_secret", client_secret);
  }

  const response = await fetch(token_endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Kode SSO tidak dapat ditukar dengan token.");
  }

  const token_payload = await response.json();

  if (!token_payload.id_token) {
    throw new Error("DashboardKU tidak mengirim id_token.");
  }

  return token_payload;
}

async function verify_id_token({ id_token, nonce, metadata }) {
  const jwks = await get_jwks(metadata);
  const { payload } = await jwtVerify(id_token, jwks, {
    issuer: get_issuer(),
    audience: get_client_id(),
  });

  if (payload.nonce !== nonce) {
    throw new Error("Nonce SSO tidak valid.");
  }

  if (!payload.sub) {
    throw new Error("Subject SSO tidak ditemukan.");
  }

  return payload;
}

function get_oidc_username(payload) {
  return String(
    payload.preferred_username ??
      payload.username ??
      payload.email ??
      "",
  ).trim();
}

async function get_session_payload_from_username(id_token_payload) {
  const username = get_oidc_username(id_token_payload);

  if (!username) {
    throw new Error("Username SSO DashboardKU tidak ditemukan.");
  }

  const admin = await prisma.tbl_admin.findFirst({
    where: {
      username,
      deleted_at: null,
    },
    select: {
      uuid: true,
      username: true,
      name: true,
      role: true,
    },
  });

  if (admin) {
    return {
      uuid: admin.uuid,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    };
  }

  const outlet = await prisma.tbl_outlet.findFirst({
    where: {
      username,
      deleted_at: null,
      is_active: true,
      excep: false,
    },
    select: {
      uuid: true,
      username: true,
      name: true,
    },
  });

  if (!outlet) {
    throw new Error("Username SSO tidak cocok dengan admin atau outlet aktif Performance Report.");
  }

  return {
    uuid: outlet.uuid,
    username: outlet.username,
    name: outlet.name,
    role: "member",
  };
}

export async function finishDashboardkuSsoLogin({ code, state, state_token }) {
  const state_payload = await verifyDashboardkuSsoState(state_token);

  if (!code) {
    throw new Error("Kode SSO tidak ditemukan.");
  }

  if (!state || state !== state_payload.state) {
    throw new Error("State SSO tidak valid.");
  }

  const metadata = await get_openid_configuration();
  const tokens = await exchange_code_for_tokens({
    code,
    code_verifier: state_payload.code_verifier,
    metadata,
  });
  const id_token_payload = await verify_id_token({
    id_token: tokens.id_token,
    nonce: state_payload.nonce,
    metadata,
  });
  const session_payload = await get_session_payload_from_username(id_token_payload);

  return {
    session_payload: {
      ...session_payload,
      auth_source: "dashboardku",
      menu_scope_keys: state_payload.menu_scope_keys,
    },
    return_to: state_payload.return_to,
  };
}
