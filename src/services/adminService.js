import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { normalizeMenuAccessKeys } from "@/lib/menu-access";
import {
  admin_account_roles,
  isSuperadmin,
  normalizeRole,
} from "@/lib/role";

async function getAdminSettingsData() {
  const data_admin = await prisma.tbl_admin.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      role: true,
      admin_menu_access: {
        where: { deleted_at: null },
        select: { key: true },
      },
    },
  });

  return data_admin.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    username: item.username,
    role: String(item.role ?? "").trim().toLowerCase(),
    menu_access_keys: item.admin_menu_access.map((access) => access.key),
  }));
}

function validate_admin_role(role) {
  const trimmed_role = normalizeRole(role);

  if (!admin_account_roles.includes(trimmed_role)) {
    throw new Error("Role admin tidak valid.");
  }

  return trimmed_role;
}

function assert_superadmin_actor(actor_role) {
  if (!isSuperadmin(actor_role)) {
    throw new Error("Hanya superadmin yang dapat mengelola akun admin.");
  }
}

async function replace_admin_menu_access(transaction, uuid_admin, keys) {
  const menu_access_keys = normalizeMenuAccessKeys(keys);

  await transaction.tbl_admin_menu_access.updateMany({
    where: {
      uuid_admin,
      deleted_at: null,
      ...(menu_access_keys.length ? { key: { notIn: menu_access_keys } } : {}),
    },
    data: { deleted_at: new Date() },
  });

  for (const key of menu_access_keys) {
    const existing_access = await transaction.tbl_admin_menu_access.findFirst({
      where: { uuid_admin, key },
      select: { uuid: true },
    });

    if (existing_access) {
      await transaction.tbl_admin_menu_access.update({
        where: { uuid: existing_access.uuid },
        data: { deleted_at: null },
      });
    } else {
      await transaction.tbl_admin_menu_access.create({
        data: {
          uuid: randomUUID(),
          uuid_admin,
          key,
        },
      });
    }
  }

  return menu_access_keys;
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
  menu_access_keys,
}) {
  assert_superadmin_actor(actor_role);

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
      deleted_at: true,
    },
  });

  if (
    !existing_admin ||
    existing_admin.deleted_at ||
    existing_admin.role == null
  ) {
    throw new Error("Data admin tidak ditemukan.");
  }

  const [duplicate_admin, duplicate_outlet] = await Promise.all([
    prisma.tbl_admin.findFirst({
      where: {
        username: trimmed_username,
        uuid: { not: uuid_admin },
      },
      select: { uuid: true },
    }),
    prisma.tbl_outlet.findUnique({
      where: { username: trimmed_username },
      select: { uuid: true },
    }),
  ]);

  if (duplicate_admin || duplicate_outlet) {
    throw new Error("Username sudah digunakan.");
  }

  if (isSuperadmin(existing_admin.role) && !isSuperadmin(trimmed_role)) {
    await assert_not_last_superadmin(existing_admin.role);
  }

  const updated_admin = await prisma.$transaction(async (transaction) => {
    const admin = await transaction.tbl_admin.update({
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
    const next_access_keys = await replace_admin_menu_access(
      transaction,
      uuid_admin,
      trimmed_role === "admin" ? menu_access_keys : [],
    );

    return { ...admin, menu_access_keys: next_access_keys };
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
  menu_access_keys,
}) {
  assert_superadmin_actor(actor_role);

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

  if (trimmed_password.length < 6) {
    throw new Error("Password admin minimal 6 karakter.");
  }

  const existing_admin = await prisma.tbl_admin.findUnique({
    where: { username: trimmed_username },
    select: { uuid: true },
  });

  if (existing_admin) {
    throw new Error("Username admin sudah digunakan.");
  }

  const existing_outlet = await prisma.tbl_outlet.findUnique({
    where: { username: trimmed_username },
    select: { uuid: true },
  });

  if (existing_outlet) {
    throw new Error("Username sudah digunakan oleh outlet.");
  }

  const hashed_password = await hashPassword(trimmed_password);
  const normalized_access_keys =
    trimmed_role === "admin" ? normalizeMenuAccessKeys(menu_access_keys) : [];
  const created_admin = await prisma.tbl_admin.create({
    data: {
      uuid: randomUUID(),
      name: trimmed_name,
      username: trimmed_username,
      password: hashed_password,
      role: trimmed_role,
      is_username_change: false,
      is_password_change: false,
      admin_menu_access: {
        create: normalized_access_keys.map((key) => ({
          uuid: randomUUID(),
          key,
        })),
      },
    },
    select: {
      uuid: true,
      name: true,
      username: true,
      role: true,
    },
  });
  const created_admin_data = {
    ...created_admin,
    menu_access_keys: normalized_access_keys,
  };

  return {
    success: true,
    data: created_admin_data,
    message: "Admin berhasil ditambahkan.",
  };
}

export async function deleteAdmin({
  uuid_admin,
  actor_role,
}) {
  assert_superadmin_actor(actor_role);

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
      deleted_at: true,
    },
  });

  if (
    !existing_admin ||
    existing_admin.deleted_at ||
    existing_admin.role == null
  ) {
    throw new Error("Data admin tidak ditemukan.");
  }

  if (isSuperadmin(existing_admin.role)) {
    throw new Error("Akun superadmin tidak dapat dihapus.");
  }

  await prisma.$transaction(async (transaction) => {
    const deleted_at = new Date();
    await transaction.tbl_admin_menu_access.updateMany({
      where: {
        uuid_admin,
        deleted_at: null,
      },
      data: { deleted_at },
    });
    await transaction.tbl_admin.update({
      where: { uuid: uuid_admin },
      data: { deleted_at },
    });
  });

  return {
    success: true,
    message: "Data admin berhasil dihapus.",
  };
}
