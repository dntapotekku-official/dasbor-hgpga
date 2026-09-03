import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  admin_account_roles,
  isSuperadmin,
  normalizeRole,
} from "@/lib/role";

export async function getAdminSettingsData() {
  const data_admin = await prisma.tbl_admin.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      role: true,
    },
  });

  return data_admin.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    username: item.username,
    role: String(item.role ?? "").trim().toLowerCase(),
  }));
}

function validate_admin_role(role) {
  const trimmed_role = normalizeRole(role);

  if (!admin_account_roles.includes(trimmed_role)) {
    throw new Error("Role admin tidak valid.");
  }

  return trimmed_role;
}

async function assert_superadmin_write_access(actor_role, target_role) {
  if (!isSuperadmin(target_role) || isSuperadmin(actor_role)) {
    return;
  }

  const superadmin_count = await prisma.tbl_admin.count({
    where: {
      role: "superadmin",
      deleted_at: null,
    },
  });

  if (superadmin_count > 0) {
    throw new Error(
      "Hanya superadmin yang dapat mengelola akun superadmin.",
    );
  }
}

async function assert_not_last_superadmin(target_role) {
  if (!isSuperadmin(target_role)) {
    return;
  }

  const superadmin_count = await prisma.tbl_admin.count({
    where: {
      role: "superadmin",
      deleted_at: null,
    },
  });

  if (superadmin_count <= 1) {
    throw new Error(
      "Superadmin terakhir tidak dapat diturunkan rolenya atau dihapus.",
    );
  }
}

export async function getAdmin() {
  return {
    data_admin: await getAdminSettingsData(),
  };
}

export async function updateAdmin({
  uuid_admin,
  name,
  username,
  role,
  actor_role,
}) {
  if (!uuid_admin) {
    throw new Error("UUID admin wajib diisi.");
  }

  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_role = validate_admin_role(role);

  if (!trimmed_name) {
    throw new Error("Nama admin wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username admin wajib diisi.");
  }

  const existing_admin = await prisma.tbl_admin.findUnique({
    where: { uuid: uuid_admin },
    select: {
      role: true,
    },
  });

  if (!existing_admin || existing_admin.role == null) {
    throw new Error("Data admin tidak ditemukan.");
  }

  await assert_superadmin_write_access(actor_role, existing_admin.role);
  await assert_superadmin_write_access(actor_role, trimmed_role);

  if (isSuperadmin(existing_admin.role) && !isSuperadmin(trimmed_role)) {
    await assert_not_last_superadmin(existing_admin.role);
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
  actor_role,
}) {
  const trimmed_name = String(name ?? "").trim();
  const trimmed_username = String(username ?? "").trim();
  const trimmed_password = String(password ?? "").trim();
  const trimmed_role = validate_admin_role(role);

  if (!trimmed_name) {
    throw new Error("Nama admin wajib diisi.");
  }

  if (!trimmed_username) {
    throw new Error("Username admin wajib diisi.");
  }

  if (!trimmed_password) {
    throw new Error("Password admin wajib diisi.");
  }

  await assert_superadmin_write_access(actor_role, trimmed_role);

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

export async function deleteAdmin({
  uuid_admin,
  actor_role,
}) {
  if (!uuid_admin) {
    throw new Error("UUID admin wajib diisi.");
  }

  const existing_admin = await prisma.tbl_admin.findUnique({
    where: {
      uuid: uuid_admin,
    },
    select: {
      uuid: true,
      role: true,
    },
  });

  if (!existing_admin || existing_admin.role == null) {
    throw new Error("Data admin tidak ditemukan.");
  }

  await assert_superadmin_write_access(actor_role, existing_admin.role);
  await assert_not_last_superadmin(existing_admin.role);

  await prisma.tbl_admin.update({
    where: {
      uuid: uuid_admin,
    },
    data: {
      deleted_at: new Date(),
    },
  });

  return {
    success: true,
    message: "Data admin berhasil dihapus.",
  };
}
