import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createCloudStorage, getCloudStorageConfig } from "../src/lib/cloudStorage.js";

const account = {
  type: "service_account",
  project_id: "test-project",
  client_email: "test@example.com",
  private_key: "test-private-key",
};

const config = { bucket: "performancereport", credentials: account };

function fixture() {
  const objects = new Map();

  const options = [];

  let failure = null;

  const store = createCloudStorage(config, (auth) => {
    assert.equal(auth.projectId, "test-project");
    assert.ok(auth.authClient);
    assert.equal(auth.credentials, undefined);

    return {
      bucket(name) {
        assert.equal(name, "performancereport");

        return {
          file(object) {
            return {
              async save(bytes, opts) {
                if (failure) {
                  throw failure;
                }

                options.push(opts);
                objects.set(object, bytes);
              },

              async download() {
                if (failure) {
                  throw failure;
                }

                return [objects.get(object)];
              },

              async delete(opts) {
                if (failure) {
                  throw failure;
                }

                assert.equal(opts.ignoreNotFound, true);
                objects.delete(object);
              },
            };
          },
        };
      },
    };
  });

  return {
    store,
    objects,
    options,
    fail(error) {
      failure = error;
    },
  };
}

test("server configuration supports generic names and existing Firebase names", () => {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64");

  const env = {
    CLOUD_STORAGE_BUCKET: "performancereport",
    CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64: encoded(account),
  };

  assert.equal(getCloudStorageConfig({}), null);
  assert.deepEqual(getCloudStorageConfig(env), config);
  assert.deepEqual(getCloudStorageConfig({ FIREBASE_STORAGE_BUCKET: env.CLOUD_STORAGE_BUCKET, FIREBASE_SERVICE_ACCOUNT_BASE64: env.CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64 }), config);
  assert.throws(() => getCloudStorageConfig({ CLOUD_STORAGE_BUCKET: "performancereport" }), /belum valid/);
  assert.throws(() => getCloudStorageConfig({ ...env, CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64: encoded({ type: "external_account" }) }), /belum lengkap/);
  assert.throws(() => getCloudStorageConfig({ ...env, CLOUD_STORAGE_BUCKET: "gs:\/\/other/path" }), /tidak valid/);
  assert.throws(() => createCloudStorage(null), /belum dikonfigurasi/);
});

test("different features and file types use the same private storage operations", async () => {
  const f = fixture();

  for (const [folder, filename, contentType] of [
    ["jam-kerja-kegiatan", `${randomUUID()}.png`, "image/png"],
    ["atribut-insanku", "dokumen.pdf", "application/pdf"],
    ["kunjungan/bukti", "rekap.csv", "text/csv"],
  ]) {
    const buffer = Buffer.from(`file contents: ${filename}`);

    const reference = await f.store.uploadFile({ folder, filename, buffer, contentType });

    assert.equal(reference, `gs://performancereport/${folder}/${filename}`);
    assert.deepEqual(await f.store.downloadFile(reference, { folder }), buffer);
    assert.equal(f.options.at(-1).metadata.contentType, contentType);
    assert.equal(f.options.at(-1).metadata.cacheControl, "private, no-store");
    assert.equal(f.options.at(-1).preconditionOpts.ifGenerationMatch, 0);
    assert.equal(f.options.at(-1).predefinedAcl, undefined);

    await f.store.deleteFile(reference, { folder });
  }

  assert.equal(f.objects.size, 0);
});

test("bucket boundaries, optional feature scopes and unsafe paths are enforced", async () => {
  const f = fixture();

  const folder = "jam-kerja-kegiatan";

  for (const reference of [
    "gs://other/jam-kerja-kegiatan/test.png",
    "gs://performancereport/private/secret.pdf",
    "gs://performancereport/jam-kerja-kegiatan-extra/test.png",
    "gs://performancereport/jam-kerja-kegiatan/../secret",
    "gs://performancereport/jam-kerja-kegiatan//photo.png",
    "https://example.com/photo.png",
  ]) {
    await assert.rejects(f.store.downloadFile(reference, { folder }), /tidak valid/);
    await assert.rejects(f.store.deleteFile(reference, { folder }), /tidak valid/);
  }

  for (const options of [
    { folder: "../private", filename: "test.png" },
    { folder, filename: "../test.png" },
    { folder: "images\\private", filename: "test.png" },
    { folder, filename: ".." },
    { folder, filename: "test.png", contentType: "text/html\r\nInjected: yes" },
  ]) {
    await assert.rejects(f.store.uploadFile({ buffer: Buffer.from("file"), ...options }), /tidak valid/);
  }

  assert.equal(f.objects.size, 0);
});

test("provider failures never expose credentials or raw request details", async () => {
  const f = fixture();

  f.fail({ code: 403, message: "secret credential in provider details" });

  await assert.rejects(f.store.uploadFile({ folder: "bukti", filename: "photo.png", buffer: Buffer.from("photo"), contentType: "image/png" }), /belum memiliki izin/);

  f.fail({ code: 500, message: "secret credential in provider details" });

  await assert.rejects(f.store.downloadFile("gs://performancereport/bukti/photo.png"), (error) => !error.message.includes("secret") && error.message.includes("Cloud Storage"));
});


test("public upload returns an encoded HTTPS URL that can also be downloaded or deleted", async () => {
  const f = fixture();

  const buffer = Buffer.from("public image");

  const url = await f.store.uploadFile({ folder: "photos", filename: "foto kegiatan #1.png", buffer, contentType: "image/png", publicUrl: true });

  assert.equal(url, "https://storage.googleapis.com/performancereport/photos/foto%20kegiatan%20%231.png");
  assert.deepEqual(await f.store.downloadFile(url, { folder: "photos" }), buffer);
  assert.equal(f.store.getPublicFileUrl("gs://performancereport/photos/foto kegiatan #1.png"), url);

  await f.store.deleteFile(url, { folder: "photos" });

  assert.equal(f.objects.size, 0);
});

test("public references still enforce bucket, folder and traversal restrictions", async () => {
  const f = fixture();

  for (const reference of [
    "https://storage.googleapis.com/other/photos/file.png",
    "https://evil.example/performancereport/photos/file.png",
    "https://storage.googleapis.com/performancereport/private/file.png",
    "https://storage.googleapis.com/performancereport/photos/%2e%2e/secret",
    "https://storage.googleapis.com/performancereport/photos/file.png?token=bad",
    "https://storage.googleapis.com/performancereport/photos/%invalid",
  ]) {
    assert.throws(() => f.store.getPublicFileUrl(reference, { folder: "photos" }), /tidak valid/);

    await assert.rejects(f.store.deleteFile(reference, { folder: "photos" }), /tidak valid/);
  }
});
