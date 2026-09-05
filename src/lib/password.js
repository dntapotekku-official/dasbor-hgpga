import { promisify } from "node:util";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scrypt_async = promisify(scrypt);
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived_key = await scrypt_async(password, salt, KEY_LENGTH);

  return `${HASH_PREFIX}$${salt}$${Buffer.from(derived_key).toString("hex")}`;
}

export async function verifyPassword(password, stored_password) {
  const normalized_stored_password = String(stored_password ?? "");

  if (normalized_stored_password.startsWith(`${HASH_PREFIX}$`)) {
    const [, salt, stored_hash] = normalized_stored_password.split("$");

    if (!salt || !stored_hash) {
      return { valid: false, needs_rehash: false };
    }

    try {
      const derived_key = await scrypt_async(password, salt, KEY_LENGTH);
      const stored_key = Buffer.from(stored_hash, "hex");
      const is_valid =
        stored_key.length === derived_key.length &&
        timingSafeEqual(stored_key, Buffer.from(derived_key));

      return { valid: is_valid, needs_rehash: false };
    } catch {
      return { valid: false, needs_rehash: false };
    }
  }

  const password_key = Buffer.from(String(password ?? ""));
  const stored_key = Buffer.from(normalized_stored_password);
  const is_valid =
    password_key.length === stored_key.length &&
    timingSafeEqual(password_key, stored_key);

  return { valid: is_valid, needs_rehash: is_valid };
}
