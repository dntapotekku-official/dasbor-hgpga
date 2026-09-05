import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isAdminAccountRole, normalizeRole } from "@/lib/role";

export default async function authenticateUser({ username, password }) {
  const normalized_username = String(username ?? "").trim();
  const normalized_password = String(password ?? "");

  if (!normalized_username || !normalized_password) {
    throw new Error("Username atau kata sandi salah.");
  }

  let user = await prisma.tbl_admin.findFirst({
    where: { username: normalized_username, deleted_at: null },
  });
  const is_admin_account = Boolean(user);

  if (!user) {
    user = await prisma.tbl_insanku.findFirst({
      where: { username: normalized_username, deleted_at: null },
    });
  }

  const password_result = await verifyPassword(normalized_password, user?.password);

  if (!user || !password_result.valid) {
    throw new Error("Username atau kata sandi salah.");
  }

  if (password_result.needs_rehash) {
    const hashed_password = await hashPassword(normalized_password);

    if (is_admin_account) {
      await prisma.tbl_admin.update({
        where: { uuid: user.uuid },
        data: { password: hashed_password },
      });
    } else {
      await prisma.tbl_insanku.update({
        where: { uuid: user.uuid },
        data: { password: hashed_password },
      });
    }
  }

  const role = is_admin_account ? normalizeRole(user.role) : "member";

  if (is_admin_account && !isAdminAccountRole(role)) {
    throw new Error("Role akun admin tidak valid.");
  }

  return {
    session_payload: {
      uuid: user.uuid,
      username: user.username,
      name: user.name,
      role,
    },
  };
}

export async function updateOwnPassword({
  user_uuid,
  user_role,
  current_password,
  new_password,
  confirm_password,
}) {
  const normalized_current_password = String(current_password ?? "");
  const normalized_new_password = String(new_password ?? "");
  const normalized_confirm_password = String(confirm_password ?? "");
  const normalized_role = normalizeRole(user_role);
  const is_member = normalized_role === "member";

  if (!is_member && !isAdminAccountRole(normalized_role)) {
    throw new Error("Role pengguna tidak valid.");
  }

  if (!user_uuid) {
    throw new Error("Sesi pengguna tidak valid.");
  }

  if (!normalized_current_password) {
    throw new Error("Password saat ini wajib diisi.");
  }

  if (!normalized_new_password) {
    throw new Error("Password baru wajib diisi.");
  }

  if (normalized_new_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  if (normalized_new_password !== normalized_confirm_password) {
    throw new Error("Konfirmasi password baru tidak cocok.");
  }

  const user_model = is_member ? prisma.tbl_insanku : prisma.tbl_admin;
  const user = await user_model.findFirst({
    where: {
      uuid: user_uuid,
      deleted_at: null,
    },
    select: {
      uuid: true,
      password: true,
    },
  });

  if (!user) {
    throw new Error("Akun tidak ditemukan.");
  }

  const current_password_result = await verifyPassword(
    normalized_current_password,
    user.password,
  );

  if (!current_password_result.valid) {
    throw new Error("Password saat ini salah.");
  }

  const new_password_result = await verifyPassword(
    normalized_new_password,
    user.password,
  );

  if (new_password_result.valid) {
    throw new Error("Password baru harus berbeda dari password saat ini.");
  }

  const hashed_password = await hashPassword(normalized_new_password);

  if (is_member) {
    await prisma.tbl_insanku.update({
      where: {
        uuid: user_uuid,
      },
      data: {
        password: hashed_password,
        is_password_change: true,
      },
    });
  } else {
    await prisma.tbl_admin.update({
      where: {
        uuid: user_uuid,
      },
      data: {
        password: hashed_password,
        is_password_change: true,
      },
    });
  }

  return {
    success: true,
    message: "Password berhasil diperbarui.",
  };
}
