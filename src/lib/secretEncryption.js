import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTED_SECRET_PREFIX = "enc:v1";

function getEncryptionKey() {
  const encryption_secret = process.env.JWT_SECRET;

  if (!encryption_secret) {
    throw new Error("JWT_SECRET belum diatur.");
  }

  return createHash("sha256")
    .update(`performance-report:api-key:v1:${encryption_secret}`)
    .digest();
}

export function isEncryptedSecret(value) {
  return String(value ?? "").startsWith(`${ENCRYPTED_SECRET_PREFIX}:`);
}

export function encryptSecret(value) {
  const plaintext = String(value ?? "");

  if (!plaintext) {
    throw new Error("Secret yang akan dienkripsi tidak boleh kosong.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authentication_tag = cipher.getAuthTag();

  return [
    ENCRYPTED_SECRET_PREFIX,
    iv.toString("base64url"),
    authentication_tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value) {
  const encrypted_value = String(value ?? "");

  if (!isEncryptedSecret(encrypted_value)) {
    return encrypted_value;
  }

  const [, , encoded_iv, encoded_tag, encoded_payload] =
    encrypted_value.split(":");

  if (!encoded_iv || !encoded_tag || !encoded_payload) {
    throw new Error("Format secret terenkripsi tidak valid.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(encoded_iv, "base64url"),
    );

    decipher.setAuthTag(Buffer.from(encoded_tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encoded_payload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error(
      "API KEY tidak dapat didekripsi. Pastikan secret enkripsi tidak berubah.",
    );
  }
}
