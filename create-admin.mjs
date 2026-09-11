import "dotenv/config";

import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";

import mariadb from "mariadb";

const scrypt_async = promisify(scrypt);

async function hash_password(password) {
  const salt = randomBytes(16).toString("hex");
  const derived_key = await scrypt_async(password, salt, 64);

  return `scrypt$${salt}$${Buffer.from(derived_key).toString("hex")}`;
}

function required_environment(name) {
  const value = String(process.env[name] ?? "").trim();

  if (!value) {
    throw new Error(`${name} wajib diatur.`);
  }

  return value;
}

async function main() {
  const database_url = new URL(required_environment("DATABASE_URL"));
  const username = required_environment("ADMIN_USERNAME");
  const password = required_environment("ADMIN_PASSWORD");
  const name = String(process.env.ADMIN_NAME ?? "Administrator").trim();

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD minimal 12 karakter.");
  }

  const connection = await mariadb.createConnection({
    host: database_url.hostname,
    port: Number(database_url.port || 3306),
    user: decodeURIComponent(database_url.username),
    password: decodeURIComponent(database_url.password),
    database: database_url.pathname.slice(1),
  });

  try {
    const hashed_password = await hash_password(password);
    const conflicting_outlet = await connection.query(
      "SELECT uuid FROM tbl_outlet WHERE username = ? AND deleted_at IS NULL LIMIT 1",
      [username],
    );

    if (conflicting_outlet.length) {
      throw new Error("Username sudah digunakan oleh outlet aktif.");
    }

    const existing_admin = await connection.query(
      "SELECT uuid FROM tbl_admin WHERE username = ? LIMIT 1",
      [username],
    );

    if (existing_admin.length) {
      await connection.query(
        "UPDATE tbl_admin SET name = ?, password = ?, role = 'superadmin', is_username_change = 0, is_password_change = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP(3) WHERE uuid = ?",
        [name, hashed_password, existing_admin[0].uuid],
      );
      console.log(`Admin ${username} berhasil diperbarui.`);
      return;
    }

    await connection.query(
      "INSERT INTO tbl_admin (uuid, name, username, password, role, is_username_change, is_password_change, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, 'superadmin', 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), NULL)",
      [randomUUID(), name, username, hashed_password],
    );
    console.log(`Admin ${username} berhasil dibuat.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Gagal membuat admin.");
  process.exitCode = 1;
});
