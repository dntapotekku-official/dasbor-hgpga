import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { get_pengaturan_data } from "@/services/pengaturanSharedService";

export async function getAdmin() {
  const data = await get_pengaturan_data();

  return {
    data_admin: data.data_admin,
  };
}

export async function updateAdmin({
  uuid_admin,
  name,
  username,
  role,
}) {
  if (!uuid_admin) {
    throw new Error("UUID admin wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_role = String(role ?? "").trim().toUpperCase();

  if (!trimmed_name) {
    throw new Error("Nama admin wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username admin wajib diisi.");
  }

  if (!["ADMIN", "VIEWER"].includes(trimmed_role)) {
    throw new Error("Role admin tidak valid.");
  }

  const updated_admin = await prisma.tbl_admin.update({
    where: { uuid: uuid_admin },
    data: {
      name: trimmed_name,
      username: trimmed_username,
      role: trimmed_role,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      role: true,
    },
  });

  return {
    success: true,
    data: updated_admin,
    message: "Data admin berhasil diperbarui.",
  };
}

export async function createAdmin({
  name,
  username,
  password,
  role,
}) {
  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const trimmed_role = String(role ?? "").trim().toUpperCase();

  if (!trimmed_name) {
    throw new Error("Nama admin wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username admin wajib diisi.");
  }

  if (!trimmed_password) {
    throw new Error("Password admin wajib diisi.");
  }

  if (!["ADMIN", "VIEWER"].includes(trimmed_role)) {
    throw new Error("Role admin tidak valid.");
  }

  const existing_admin = await prisma.tbl_admin.findUnique({
    where: { username: trimmed_username },
    select: { uuid: true },
  });

  if (existing_admin) {
    throw new Error("Username admin sudah digunakan.");
  }

  const existing_karyawan = await prisma.tbl_karyawan.findUnique({
    where: { username: trimmed_username },
    select: { uuid: true },
  });

  if (existing_karyawan) {
    throw new Error("Username sudah digunakan oleh karyawan.");
  }

  const created_admin = await prisma.tbl_admin.create({
    data: {
      uuid: randomUUID(),
      name: trimmed_name,
      username: trimmed_username,
      password: trimmed_password,
      role: trimmed_role,
      is_username_change: false,
      is_password_change: false,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      role: true,
    },
  });

  return {
    success: true,
    data: created_admin,
    message: "Admin berhasil ditambahkan.",
  };
}
