import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseKegiatanDuration, formatKegiatanDuration } from "../src/lib/kegiatanDuration.js";
import { readImageUpload, getImageType, MAX_IMAGE_UPLOAD_SIZE } from "../src/lib/imageUpload.js";

const source = readFileSync(new URL("../src/services/jamKerjaInsanKuService.js", import.meta.url), "utf8");
const load = (dependencies) => new Function(
  ...Object.keys(dependencies),
  source.replace(/^import .*;\n/gm, "").replace(/^export /gm, "") + "\nreturn { getJamKerjaKegiatan, createJamKerjaKegiatan, getJamKerjaKegiatanPhoto, updateJamKerjaKegiatan, deleteJamKerjaKegiatan };",
)(...Object.values(dependencies));
const id = "11111111-1111-4111-8111-111111111111";
const scope = { id, month: "11", year: "2026" };
const activity = { ...scope, date: "2026-11-05", description: " Pelatihan outlet ", hours_value: "1.30" };
function fixture() {
  const rows = [], photos = new Set();
  let fail = false;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) return row[key] >= value.gte && row[key] < value.lt;
    return row[key] === value;
  });
  const client = {
    async $transaction(action) {
      const before = structuredClone(rows);
      try { return await action(client); }
      catch (error) { rows.splice(0, rows.length, ...before); throw error; }
    },
    tbl_outlet_insanku: { findFirst: async ({ where }) => where.uuid === id && (!where.uuid_outlet || where.uuid_outlet === "outlet-a") ? { uuid: id } : null },
    tbl_jam_kerja_insanku_harian: {
      findMany: async ({ where }) => rows.filter((row) => row.uuid_outlet_insanku === where.uuid_outlet_insanku && !row.deleted_at && row.date >= where.date.gte && row.date < where.date.lt),
      create: async ({ data }) => { if (fail) throw new Error("Write failed"); const row = { ...data, deleted_at: null }; rows.push(row); return row; },
      findFirst: async ({ where }) => structuredClone(rows.find((row) => matches(row, where))),
      updateMany: async ({ where, data }) => {
        if (fail) throw new Error("Write failed");
        const selected = rows.filter((row) => matches(row, where));
        selected.forEach((row) => Object.assign(row, data));
        return { count: selected.length };
      },
    },
  };
  const legacy_reads = [];

  const legacy_deletes = [];

  const service = load({
    prisma: client,
    randomUUID,
    parseKegiatanDuration,
    path,
    readImageUpload: async (file) => {
      if (!file) {
        throw new Error("Foto wajib");
      }

      return { bytes: Buffer.from("image"), extension: "jpg", mime: "image/jpeg" };
    },
    getImageType: () => ({ mime: "image/jpeg" }),
    uploadFile: async ({ folder, filename, buffer, contentType, publicUrl }) => {
      assert.equal(folder, "jam-kerja-kegiatan");
      assert.equal(contentType, "image/jpeg");
      assert.equal(publicUrl, true);
      assert.equal(buffer.toString(), "image");

      const reference = `https://storage.googleapis.com/performancereport/${folder}/${filename}`;

      photos.add(reference);

      return reference;
    },
    getPublicFileUrl: (reference, { folder }) => {
      assert.equal(folder, "jam-kerja-kegiatan");

      return reference.replace("gs://performancereport/", "https://storage.googleapis.com/performancereport/");
    },
    downloadFile: async (reference, { folder }) => {
      assert.equal(folder, "jam-kerja-kegiatan");
      assert.ok(photos.has(reference));

      return Buffer.from("image");
    },
    deleteFile: async (reference, { folder }) => {
      assert.equal(folder, "jam-kerja-kegiatan");

      photos.delete(reference);
    },
    readFile: async (filename) => {
      legacy_reads.push(filename);

      return Buffer.from("legacy image");
    },
    unlink: async (filename) => {
      legacy_deletes.push(filename);
    },
  });

  return {
    ...service,
    rows,
    photos,
    legacy_reads,
    legacy_deletes,
    failWrite() {
      fail = true;
    },
  };
}

test("adds hour-minute activities, trims descriptions and reads only the chosen placement and period", async () => {
  const f = fixture();
  const result = await f.createJamKerjaKegiatan(activity, {});
  assert.equal(result.data.hours_value, 1.5);
  assert.equal(result.data.description, "Pelatihan outlet");
  assert.equal(result.data.date, "2026-11-05");
  assert.match(result.data.img_url, /^https:\/\/storage\.googleapis\.com\/performancereport\/jam-kerja-kegiatan\//);
  await f.createJamKerjaKegiatan({ ...activity, month: "12", date: "2026-12-01", hours_value: "0.15" }, {});
  assert.equal((await f.getJamKerjaKegiatan(scope)).data.length, 1);
  assert.equal((await f.getJamKerjaKegiatan({ ...scope, month: "12" })).data[0].hours_value, 0.25);
  f.rows[0].deleted_at = new Date();
  assert.equal((await f.getJamKerjaKegiatan(scope)).data.length, 0);
});

test("rejects invalid dates, dates outside the chosen month, descriptions and durations before storing photos", async () => {
  const f = fixture();
  for (const date of ["2026-11-31", "2026-10-31", "2026-12-01", "bad"]) await assert.rejects(f.createJamKerjaKegiatan({ ...activity, date }, {}));
  for (const hours_value of ["", "0", "-1", "1,2,3", "Infinity", "NaN", "1e2", "1,30", "1.60", "1.999"]) await assert.rejects(f.createJamKerjaKegiatan({ ...activity, hours_value }, {}));
  await assert.rejects(f.createJamKerjaKegiatan({ ...activity, description: "  " }, {}));
  await assert.rejects(f.createJamKerjaKegiatan({ ...activity, month: "13" }, {}));
  assert.equal(f.photos.size, 0);
  assert.equal(f.rows.length, 0);
});

test("members cannot list, create or retrieve another outlet's activities and photos", async () => {
  const f = fixture();
  const result = await f.createJamKerjaKegiatan(activity, {}, { role: "member", uuid: "outlet-a" });
  const denied = { role: "member", uuid: "outlet-b" };
  await assert.rejects(f.getJamKerjaKegiatan(scope, denied), /diakses/);
  await assert.rejects(f.createJamKerjaKegiatan(activity, {}, denied), /diakses/);
  await assert.rejects(f.getJamKerjaKegiatanPhoto(result.data.uuid, denied), /diakses/);
  await assert.rejects(f.getJamKerjaKegiatan(scope, { role: "member" }), /tidak valid/);
  assert.equal((await f.getJamKerjaKegiatanPhoto(result.data.uuid, { role: "member", uuid: "outlet-a" })).mime, "image/jpeg");
  assert.equal(f.rows.length, 1);
});

test("failed database writes remove the uploaded photo", async () => {
  const f = fixture(); f.failWrite();
  await assert.rejects(f.createJamKerjaKegiatan(activity, {}), /Write failed/);
  assert.equal(f.photos.size, 0);
});

test("image validation inspects file signatures and enforces the size limit", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");

  const image = await readImageUpload(new File([png], "photo.png", { type: "image/png" }));

  assert.equal(image.mime, "image/png");
  assert.deepEqual(image.bytes, png);
  assert.equal(getImageType(image.bytes).extension, "png");

  await assert.rejects(readImageUpload(new File(["<svg>bad</svg>"], "fake.png", { type: "image/png" })), /JPG/);
  await assert.rejects(readImageUpload({ size: MAX_IMAGE_UPLOAD_SIZE + 1, arrayBuffer() {} }), /5 MB/);
});

test("legacy local photos remain readable and replacements remove the old file without path traversal", async () => {
  const f = fixture();

  const created = await f.createJamKerjaKegiatan(activity, {});

  const filename = `${created.data.uuid}.jpg`;

  f.rows[0].img_url = filename;

  assert.equal((await f.getJamKerjaKegiatanPhoto(created.data.uuid)).bytes.toString(), "legacy image");
  assert.equal(f.legacy_reads[0], path.join(process.cwd(), ".data", "jam-kerja-kegiatan", filename));

  await f.updateJamKerjaKegiatan({ ...activity, uuid: created.data.uuid }, { size: 1 });

  assert.equal(f.legacy_deletes[0], f.legacy_reads[0]);
  assert.match(f.rows[0].img_url, /^https:\/\/storage\.googleapis\.com\/performancereport\/jam-kerja-kegiatan\//);

  f.rows[0].img_url = "../../.env";

  await assert.rejects(f.getJamKerjaKegiatanPhoto(created.data.uuid), /tidak valid/);

  assert.equal(f.legacy_reads.length, 1);
});


test("hour-minute durations convert accurately and display back in the same format", () => {
  for (const [input, expected, display] of [["1.30", 1.5, "1.30"], ["0.15", 0.25, "0.15"], ["1.05", 65 / 60, "1.05"], ["0.01", 1 / 60, "0.01"], ["2", 2, "2.00"], ["1.45", 1.75, "1.45"]]) {
    assert.equal(parseKegiatanDuration(input), expected);
    assert.equal(formatKegiatanDuration(expected), display);
  }
});


test("edit updates date, description and hours while preserving the existing photo when no replacement is supplied", async () => {
  const f = fixture();
  const created = await f.createJamKerjaKegiatan(activity, {});
  const result = await f.updateJamKerjaKegiatan({ ...activity, uuid: created.data.uuid, date: "2026-11-06", description: "Kegiatan diperbarui", hours_value: "2.15" }, null);
  assert.equal(result.data.date, "2026-11-06");
  assert.equal(result.data.description, "Kegiatan diperbarui");
  assert.equal(result.data.hours_value, 2.25);
  assert.equal(result.data.img_url, created.data.img_url);
  assert.equal(f.photos.size, 1);
});

test("edit replaces the photo and failure cleans up the new upload while preserving the old photo", async () => {
  const f = fixture();
  const created = await f.createJamKerjaKegiatan(activity, {});
  const oldFile = f.rows[0].img_url;
  const updated = await f.updateJamKerjaKegiatan({ ...activity, uuid: created.data.uuid }, { size: 1 });
  assert.notEqual(updated.data.img_url, created.data.img_url);
  assert.equal(f.photos.has(oldFile), false);
  const currentPhoto = f.rows[0].img_url;
  assert.equal(f.photos.has(currentPhoto), true);
  f.failWrite();
  await assert.rejects(f.updateJamKerjaKegiatan({ ...activity, uuid: created.data.uuid }, { size: 1 }), /Write failed/);
  assert.deepEqual([...f.photos], [currentPhoto]);
  assert.equal(f.rows[0].img_url, currentPhoto);
});

test("edit and delete require access to the same placement and period, and deleted activities cannot be edited or viewed", async () => {
  const f = fixture();
  const created = await f.createJamKerjaKegiatan(activity, {});
  const payload = { ...activity, uuid: created.data.uuid };
  const denied = { role: "member", uuid: "outlet-b" };
  await assert.rejects(f.updateJamKerjaKegiatan(payload, null, denied));
  await assert.rejects(f.deleteJamKerjaKegiatan(payload, denied));
  await assert.rejects(f.updateJamKerjaKegiatan({ ...payload, month: "12" }, null));
  await assert.rejects(f.deleteJamKerjaKegiatan({ ...payload, month: "12" }));
  await assert.rejects(f.updateJamKerjaKegiatan({ ...payload, date: "2026-12-01" }, null));
  await f.deleteJamKerjaKegiatan(payload);
  assert.ok(f.rows[0].deleted_at);
  assert.equal((await f.getJamKerjaKegiatan(scope)).data.length, 0);
  await assert.rejects(f.getJamKerjaKegiatanPhoto(created.data.uuid));
  await assert.rejects(f.updateJamKerjaKegiatan(payload, null));
  await assert.rejects(f.deleteJamKerjaKegiatan(payload));
});


test("existing gs references are returned as direct public URLs without rewriting the database", async () => {
  const f = fixture();

  await f.createJamKerjaKegiatan(activity, {});

  const old_reference = "gs://performancereport/jam-kerja-kegiatan/old-photo.jpg";

  f.rows[0].img_url = old_reference;

  const result = await f.getJamKerjaKegiatan(scope);

  assert.equal(result.data[0].img_url, "https://storage.googleapis.com/performancereport/jam-kerja-kegiatan/old-photo.jpg");
  assert.equal(f.rows[0].img_url, old_reference);
});
