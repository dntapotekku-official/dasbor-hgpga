import { Storage } from "@google-cloud/storage";
import { JWT } from "google-auth-library";

let shared_storage;

/** Membaca dan memvalidasi konfigurasi bucket serta service account di server. */
export function getCloudStorageConfig(env = process.env) {
  const bucket = String(env.CLOUD_STORAGE_BUCKET ?? env.FIREBASE_STORAGE_BUCKET ?? "").trim();

  if (!bucket) {
    return null;
  }

  if (!/^[a-z0-9][a-z0-9._-]+[a-z0-9]$/.test(bucket)) {
    throw new Error("Nama bucket Cloud Storage tidak valid.");
  }

  const encoded = env.CLOUD_STORAGE_SERVICE_ACCOUNT_BASE64 ?? env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "";

  let credentials;

  try {
    credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("Konfigurasi service account Cloud Storage belum valid.");
  }

  if (
    credentials?.type !== "service_account" ||
    !credentials.project_id ||
    !credentials.client_email ||
    !credentials.private_key
  ) {
    throw new Error("Konfigurasi service account Cloud Storage belum lengkap.");
  }

  return { bucket, credentials };
}

/** Memastikan path objek tidak kosong dan tidak mengandung traversal direktori. */
function validate_path(value) {
  if (typeof value !== "string" || !value || /[\\\x00-\x1f\x7f]/.test(value)) {
    throw new Error("Path Cloud Storage tidak valid.");
  }

  const segments = value.split("/");

  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Path Cloud Storage tidak valid.");
  }

  return value;
}

/** Mengubah kegagalan penyedia storage menjadi pesan aman tanpa kredensial. */
function storage_error(error) {
  if (Number(error.code) === 403) {
    return new Error("Service account belum memiliki izin akses ke bucket Cloud Storage.");
  }

  if (Number(error.code) === 401 || error.code === "invalid_grant") {
    return new Error("Kredensial Cloud Storage tidak valid atau sudah dicabut.");
  }

  if (Number(error.code) === 404) {
    return new Error("Bucket atau file tidak ditemukan di Cloud Storage.");
  }

  return new Error("Gagal mengakses Cloud Storage. Periksa konfigurasi bucket dan koneksi server.");
}

/** Server only. Pemanggil memeriksa hak akses pengguna sebelum mengakses file. */
export function createCloudStorage(
  config = getCloudStorageConfig(),
  storageFactory = (options) => new Storage(options),
) {
  if (!config) {
    throw new Error("Cloud Storage belum dikonfigurasi.");
  }

  const authClient = new JWT({
    email: config.credentials.client_email,
    key: config.credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
  });

  const storage = storageFactory({
    projectId: config.credentials.project_id,
    authClient,
  });

  const bucket = storage.bucket(config.bucket);

  /** Mengambil nama objek dari referensi bucket dan memeriksa batas folder fitur. */
  function object_name(reference, folder) {
    const expected = `gs://${config.bucket}/`;

    const public_prefix = `https://storage.googleapis.com/${config.bucket}/`;

    let raw_name;

    if (typeof reference === "string" && reference.startsWith(expected)) {
      raw_name = reference.slice(expected.length);
    } else if (typeof reference === "string" && reference.startsWith(public_prefix)) {
      const encoded_name = reference.slice(public_prefix.length);

      if (/[?#]/.test(encoded_name)) {
        throw new Error("Referensi Cloud Storage tidak valid.");
      }

      try {
        raw_name = decodeURIComponent(encoded_name);
      } catch {
        throw new Error("Referensi Cloud Storage tidak valid.");
      }
    } else {
      throw new Error("Referensi Cloud Storage tidak valid.");
    }

    const name = validate_path(raw_name);

    if (folder !== undefined && !name.startsWith(`${validate_path(folder)}/`)) {
      throw new Error("Referensi Cloud Storage tidak valid untuk folder ini.");
    }

    return name;
  }

  /** Membentuk URL HTTPS objek dengan encoding nama file yang benar. */
  function public_file_url(reference, options = {}) {
    const name = object_name(reference, options.folder);

    const encoded_name = name.split("/").map(encodeURIComponent).join("/");

    return `https://storage.googleapis.com/${config.bucket}/${encoded_name}`;
  }

  return {
    getPublicFileUrl: public_file_url,

    /** Mengunggah file baru ke folder bucket dan mengembalikan referensi atau URL-nya. */
    async uploadFile({ folder, filename, buffer, contentType = "application/octet-stream", publicUrl = false }) {
      if (typeof filename !== "string" || filename.includes("/")) {
        throw new Error("Nama file Cloud Storage tidak valid.");
      }

      const name = `${validate_path(folder)}/${validate_path(filename)}`;

      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        throw new Error("Isi file Cloud Storage tidak valid.");
      }

      if (typeof contentType !== "string" || !/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) {
        throw new Error("Tipe file Cloud Storage tidak valid.");
      }

      try {
        await bucket.file(name).save(buffer, {
          resumable: false,
          validation: "crc32c",
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType, cacheControl: "private, no-store" },
        });
      } catch (error) {
        throw storage_error(error);
      }

      const reference = `gs://${config.bucket}/${name}`;

      return publicUrl ? public_file_url(reference) : reference;
    },

    /** Membaca isi file bucket ke buffer untuk pemrosesan di server. */
    async downloadFile(reference, { folder } = {}) {
      const name = object_name(reference, folder);

      try {
        const [bytes] = await bucket.file(name).download();

        return bytes;
      } catch (error) {
        throw storage_error(error);
      }
    },

    /** Menghapus objek bucket setelah pemeriksaan referensi dan folder. */
    async deleteFile(reference, { folder } = {}) {
      const name = object_name(reference, folder);

      try {
        await bucket.file(name).delete({ ignoreNotFound: true });
      } catch (error) {
        throw storage_error(error);
      }
    },
  };
}

/** Menggunakan ulang satu koneksi Cloud Storage selama proses server berjalan. */
export function getCloudStorage() {
  if (!shared_storage) {
    shared_storage = createCloudStorage();
  }

  return shared_storage;
}

/** Mengunggah file baru ke folder bucket dan mengembalikan referensi atau URL-nya. */
export function uploadFile(options) {
  return getCloudStorage().uploadFile(options);
}

/** Membaca isi file bucket ke buffer untuk pemrosesan di server. */
export function downloadFile(reference, options) {
  return getCloudStorage().downloadFile(reference, options);
}

/** Menghapus objek bucket setelah pemeriksaan referensi dan folder. */
export function deleteFile(reference, options) {
  return getCloudStorage().deleteFile(reference, options);
}

/** Memvalidasi referensi objek dan menghasilkan URL publik HTTPS. */
export function getPublicFileUrl(reference, options) {
  return getCloudStorage().getPublicFileUrl(reference, options);
}
