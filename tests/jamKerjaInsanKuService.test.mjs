import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/services/jamKerjaInsanKuService.js", import.meta.url), "utf8");
const load = new Function("prisma", "createHash", source.replace(/^import .*;\n/gm, "").replace(/^export /gm, "") + "\nreturn {getJamKerjaInsanKu, updateJamKerjaInsanKu, deleteJamKerjaInsanKu};");
const first_id = "11111111-1111-4111-8111-111111111111";
const second_id = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const placements = [first_id, second_id].map((uuid, index) => ({
    uuid, uuid_outlet: `outlet-${index}`, insanku: { name: `Nama ${index}` }, outlet: { name: `Outlet ${index}` }, jam_kerja_insanku_bulanan: [],
  }));
  const client = {
    tbl_outlet_insanku: {
      async findMany({where, include}) {
        const range = include.jam_kerja_insanku_bulanan.where.date;
        return structuredClone(placements
          .filter((row) => (!where.uuid || where.uuid.in.includes(row.uuid)) && (!where.uuid_outlet || row.uuid_outlet === where.uuid_outlet))
          .map((row) => ({ ...row, jam_kerja_insanku_bulanan: row.jam_kerja_insanku_bulanan.filter((record) => record.date >= range.gte && record.date < range.lt).slice(-1) })));
      },
    },
    tbl_jam_kerja_insanku_bulanan: {
      async upsert({where, create, update}) {
        const placement = placements.find((row) => row.uuid === create.uuid_outlet_insanku);
        const record = placement.jam_kerja_insanku_bulanan.find((row) => row.uuid === where.uuid);
        if (record) Object.assign(record, update);
        else placement.jam_kerja_insanku_bulanan.push({ pharmapp_value: 0, excel_value: 0, is_verfified: false, is_validated: false, deleted_at: null, ...create });
      },
    },
    async $transaction(action) { return action(client); },
  };
  return { ...load(client, createHash), placements };
}

test("reads names and outlets from placements with zero initial hours", async () => {
  const service = fixture();
  const {data} = await service.getJamKerjaInsanKu();
  assert.equal(data.length, 2);
  assert.deepEqual(data[0], { id: first_id, name: "Nama 0", outlet: "Outlet 0", pharmaapp: 0, excel: 0, verified: false, validated: false });
});

test("edits both hour values and preserves them after bulk checkbox changes", async () => {
  const service = fixture();
  await service.updateJamKerjaInsanKu({id: first_id, pharmaapp: "176", excel: "168"});
  await service.updateJamKerjaInsanKu({ids: [first_id, second_id], verified: true});
  await service.updateJamKerjaInsanKu({id: second_id, validated: true});
  const {data} = await service.getJamKerjaInsanKu();
  assert.equal(data[0].pharmaapp, 176);
  assert.equal(data[0].excel, 168);
  assert.ok(data.every((row) => row.verified));
  assert.equal(data[0].validated, false);
  assert.equal(data[1].validated, true);
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan.length, 1);
});

test("clearing hours keeps the row, statuses, and placement and allows editing again", async () => {
  const service = fixture();
  await service.updateJamKerjaInsanKu({ id: first_id, pharmaapp: 176, excel: 170, verified: true, validated: true });
  await service.deleteJamKerjaInsanKu({id: first_id});
  assert.equal(service.placements.length, 2);
  const { data } = await service.getJamKerjaInsanKu();
  assert.equal(data.length, 2);
  assert.equal(data[0].pharmaapp, 0);
  assert.equal(data[0].excel, 0);
  assert.equal(data[0].verified, true);
  assert.equal(data[0].validated, true);
  await service.updateJamKerjaInsanKu({id: first_id, excel: 10});
  assert.equal((await service.getJamKerjaInsanKu()).data[0].excel, 10);
});

test("rejects invalid hours, checkbox types, and unknown placements before writing", async () => {
  const service = fixture();
  for (const value of ["", null, true, -1, "abc", Infinity, NaN]) {
    await assert.rejects(service.updateJamKerjaInsanKu({id: first_id, excel: value}), /angka nonnegatif/);
  }
  await assert.rejects(service.updateJamKerjaInsanKu({id: first_id, verified: "true"}), /checkbox/);
  await assert.rejects(service.updateJamKerjaInsanKu({ids: [first_id, "33333333-3333-4333-8333-333333333333"], verified: true}), /tidak tersedia/);
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan.length, 0);
});

test("outlet sessions can only read and mutate their own placements", async () => {
  const service = fixture();
  const access = { role: "member", uuid: "outlet-0" };
  assert.deepEqual((await service.getJamKerjaInsanKu(access)).data.map((row) => row.id), [first_id]);
  await service.updateJamKerjaInsanKu({ id: first_id, excel: 168 }, access);
  await assert.rejects(service.updateJamKerjaInsanKu({ id: second_id, excel: 100 }, access), /tidak tersedia/);
  await assert.rejects(service.updateJamKerjaInsanKu({ ids: [first_id, second_id], validated: true }, access), /tidak tersedia/);
  await assert.rejects(service.deleteJamKerjaInsanKu({ id: second_id }, access), /tidak ditemukan/);
  assert.equal(service.placements[1].jam_kerja_insanku_bulanan.length, 0);
  assert.equal((await service.getJamKerjaInsanKu(access)).data[0].validated, false);
  await service.deleteJamKerjaInsanKu({ id: first_id }, access);
  assert.equal((await service.getJamKerjaInsanKu(access)).data[0].excel, 0);
});

test("missing outlet identity fails closed while admin can read all outlets", async () => {
  const service = fixture();
  await assert.rejects(service.getJamKerjaInsanKu({ role: "member" }), /tidak valid/);
  assert.equal((await service.getJamKerjaInsanKu({ role: "admin", uuid: "admin" })).data.length, 2);
});


test("hours and checkbox statuses are isolated by month and year, including decimals", async () => {
  const service = fixture();
  const november = { month: "11", year: "2026" };
  const december = { month: "12", year: "2026" };
  const next_year = { month: "11", year: "2027" };
  await service.updateJamKerjaInsanKu({ id: first_id, ...november, pharmaapp: 168.5, excel: 170.25, verified: true });
  await service.updateJamKerjaInsanKu({ id: first_id, ...december, pharmaapp: 80.5, validated: true });
  await service.updateJamKerjaInsanKu({ id: first_id, ...next_year, pharmaapp: 90 });
  const nov = (await service.getJamKerjaInsanKu({}, november)).data[0];
  const dec = (await service.getJamKerjaInsanKu({}, december)).data[0];
  const next = (await service.getJamKerjaInsanKu({}, next_year)).data[0];
  assert.equal(nov.pharmaapp, 168.5);
  assert.equal(nov.excel, 170.25);
  assert.equal(nov.verified, true);
  assert.equal(nov.validated, false);
  assert.equal(dec.pharmaapp, 80.5);
  assert.equal(dec.verified, false);
  assert.equal(dec.validated, true);
  assert.equal(next.pharmaapp, 90);
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan.length, 3);
  assert.equal(new Set(service.placements[0].jam_kerja_insanku_bulanan.map((row) => row.uuid)).size, 3);
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan[0].date.toISOString(), "2026-11-01T00:00:00.000Z");
  await service.deleteJamKerjaInsanKu({ id: first_id, ...november });
  assert.equal((await service.getJamKerjaInsanKu({}, november)).data[0].pharmaapp, 0);
  assert.equal((await service.getJamKerjaInsanKu({}, november)).data.length, 2);
  assert.equal((await service.getJamKerjaInsanKu({}, december)).data[0].pharmaapp, 80.5);
  await service.updateJamKerjaInsanKu({ id: first_id, ...november, validated: true });
});

test("rejects invalid months and years before reading or writing", async () => {
  const service = fixture();
  for (const period of [{ month: "0", year: "2026" }, { month: "13", year: "2026" }, { month: "all", year: "2026" }, { month: "11", year: "abc" }, { month: "11", year: "0" }]) {
    await assert.rejects(service.getJamKerjaInsanKu({}, period), /Bulan dan tahun/);
    await assert.rejects(service.updateJamKerjaInsanKu({ id: first_id, excel: 10, ...period }), /Bulan dan tahun/);
    await assert.rejects(service.deleteJamKerjaInsanKu({ id: first_id, ...period }), /Bulan dan tahun/);
  }
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan.length, 0);
});


test("legacy soft-deleted rows remain visible with zero hours and can be edited", async () => {
  const service = fixture();
  await service.updateJamKerjaInsanKu({ id: first_id, pharmaapp: 100, excel: 99, verified: true });
  service.placements[0].jam_kerja_insanku_bulanan[0].deleted_at = new Date();
  const { data } = await service.getJamKerjaInsanKu();
  assert.equal(data.length, 2);
  assert.equal(data[0].pharmaapp, 0);
  assert.equal(data[0].excel, 0);
  await service.updateJamKerjaInsanKu({ id: first_id, excel: 10 });
  const row = (await service.getJamKerjaInsanKu()).data[0];
  assert.equal(row.pharmaapp, 0);
  assert.equal(row.excel, 10);
  assert.equal(service.placements[0].jam_kerja_insanku_bulanan[0].deleted_at, null);
});
