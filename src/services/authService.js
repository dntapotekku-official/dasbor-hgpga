import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/role";

export default async function authenticateUser({ username, password }) {
  let user = await prisma.tbl_admin.findUnique({
    where: { username },
  });
  let role = "ADMIN";

  if (!user) {
    user = await prisma.tbl_karyawan.findUnique({
      where: { username },
    });
    role = "VIEWER";
  }

  if (!user || user.password !== password) {
    throw new Error("Username atau kata sandi salah.");
  }

  return {
    user,
    session_payload: {
      uuid: user.uuid,
      username: user.username,
      name: user.name,
      role: user.role ?? role,
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
  const trimmed_current_password = String(current_password ?? "").trim();
  const trimmed_new_password = String(new_password ?? "").trim();
  const trimmed_confirm_password = String(confirm_password ?? "").trim();
  const normalized_role = normalizeRole(user_role);
  const is_member = normalized_role === "member";

  if (!user_uuid) {
    throw new Error("Sesi pengguna tidak valid.");
  }

  if (!trimmed_current_password) {
    throw new Error("Password saat ini wajib diisi.");
  }

  if (!trimmed_new_password) {
    throw new Error("Password baru wajib diisi.");
  }

  if (trimmed_new_password.length < 6) {
    throw new Error("Password baru minimal 6 karakter.");
  }

  if (trimmed_new_password !== trimmed_confirm_password) {
    throw new Error("Konfirmasi password baru tidak cocok.");
  }

  const user = is_member
    ? await prisma.tbl_karyawan.findFirst({
        where: {
          uuid: user_uuid,
          deleted_at: null,
        },
        select: {
          uuid: true,
          password: true,
        },
      })
    : await prisma.tbl_admin.findFirst({
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

  if (String(user.password ?? "") !== trimmed_current_password) {
    throw new Error("Password saat ini salah.");
  }

  if (trimmed_current_password === trimmed_new_password) {
    throw new Error("Password baru harus berbeda dari password saat ini.");
  }

  if (is_member) {
    await prisma.tbl_karyawan.update({
      where: {
        uuid: user_uuid,
      },
      data: {
        password: trimmed_new_password,
        is_password_change: true,
      },
    });
  } else {
    await prisma.tbl_admin.update({
      where: {
        uuid: user_uuid,
      },
      data: {
        password: trimmed_new_password,
        is_password_change: true,
      },
    });
  }

  return {
    success: true,
    message: "Password berhasil diperbarui.",
  };
}
