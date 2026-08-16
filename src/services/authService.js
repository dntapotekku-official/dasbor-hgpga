import { prisma } from "@/lib/prisma";

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
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role ?? role,
    },
  };
}
