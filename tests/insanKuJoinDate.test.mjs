import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseSlipGajiJoinDate } from "../src/lib/slipGajiJoinDate.js";

const source = readFileSync(new URL("../src/services/insanKuService.js", import.meta.url), "utf8");
const normalizeInsanKuRows = new Function(
  "parseSlipGajiJoinDate", "getInsanKuPayloadUuid", "normalizeNik", "buildDefaultInsanKuUsername",
  "DEFAULT_INSANKU_PASSWORD", "dedupeByUuid",
  source.slice(source.indexOf("export function normalizeInsanKuRows("), source.indexOf("export async function getInsanKuSettingsData("))
    .replace("export ", "") + "\nreturn normalizeInsanKuRows;",
)(parseSlipGajiJoinDate, (item) => item.uuid, (value) => value, () => "user@apotekku", "password", (rows) => rows);

test("API tgl_bergabung becomes a nullable join_date", () => {
  const rows = normalizeInsanKuRows([
    { uuid: "dated", tgl_bergabung: "2024-02-29" },
    { uuid: "empty", tgl_bergabung: "" },
    { uuid: "null", tgl_bergabung: null },
    { uuid: "missing" },
  ]);
  assert.equal(rows[0].join_date.toISOString(), "2024-02-29T00:00:00.000Z");
  for (const row of rows.slice(1)) assert.equal(row.join_date, null);
  assert.equal(normalizeInsanKuRows([{ uuid: "invalid", tgl_bergabung: "invalid" }])[0].join_date, null);
});

test("API dates support SQL, ISO timestamps and Indonesian numeric dates without shifting days", () => {
  for (const value of ["2024-02-29", "2024-02-29 00:00:00", "2024-02-29T00:00:00.000Z", "2024-02-29T00:00:00+08:00", "29/02/2024", "29-02-2024", " 2024-02-29 "]) {
    assert.equal(parseSlipGajiJoinDate(value)?.toISOString(), "2024-02-29T00:00:00.000Z", value);
  }
  for (const value of [null, undefined, "", "-", "0000-00-00", "0000-00-00 00:00:00", "2026-02-29", "2026-04-31", "2026-13-01", "invalid", 123, {}]) {
    assert.equal(parseSlipGajiJoinDate(value), null);
  }
});

test("sync writes join_date for new and existing employees and respects skip sync", async () => {
  const created = [];
  const updated = [];
  const existing = ["existing", "invalid", "skipped"].map((uuid) => ({
    uuid, username: `${uuid}@apotekku`, is_skip_sync: uuid === "skipped",
    is_active: true, deleted_at: null,
  }));
  const tx = {
    tbl_insanku: {
      async createMany({ data }) { created.push(...data); return { count: data.length }; },
      async update({ where, data }) { updated.push({ uuid: where.uuid, ...data }); },
      async updateMany() {},
    },
  };
  const sync = new Function(
    "prisma", "fetchInsanKuPayload", "fetchOutletInsanKuPayload", "normalizeOutletInsanKuUsernames",
    "normalizeInsanKuRows", "normalizeUsernameKey", "hashPassword", "DEFAULT_INSANKU_PASSWORD",
    "closeInsanKuInactivePeriod", "openInsanKuInactivePeriod", "currentPlacementMonth", "createInsanKuPreActivePeriod", "currentPlacementDay",
    source.slice(source.indexOf("export async function syncInsanKu("), source.indexOf("export async function getInsanKu("))
      .replace("export ", "") + "\nreturn syncInsanKu;",
  )(
    { tbl_insanku: { findMany: async () => existing }, $transaction: (fn) => fn(tx) },
    async () => ["new", "existing", "invalid", "skipped"].map((uuid) => ({ uuid, tgl_bergabung: uuid === "invalid" ? "0000-00-00" : "2026-01-15 00:00:00" })),
    async () => [], () => new Map(), normalizeInsanKuRows, (value) => value,
    async () => "hashed", "password", async () => {}, async () => {}, () => new Date("2026-10-01"), async () => {}, () => new Date("2026-10-29"),
  );
  await sync();
  assert.equal(created.length, 1);
  assert.equal(created[0].join_date.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(updated.length, 2);
  assert.equal(updated[0].uuid, "existing");
  assert.equal(updated[0].join_date.toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(Object.hasOwn(updated[1], "join_date"), false, "invalid API dates must preserve the stored date");
});
