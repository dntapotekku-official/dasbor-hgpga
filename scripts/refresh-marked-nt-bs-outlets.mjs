import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { refreshMarkedNtBsOutlets } from "../src/services/markedNtBsOutletService.js";

const database = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });
try {
  console.log(await refreshMarkedNtBsOutlets(database));
} catch (error) {
  console.error(`${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
