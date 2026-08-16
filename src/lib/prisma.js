import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const global_for_prisma = globalThis;

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

export const prisma =
  global_for_prisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global_for_prisma.prisma = prisma;
}
