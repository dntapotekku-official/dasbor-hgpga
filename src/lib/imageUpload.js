export const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Mengenali JPG, PNG, atau WebP dari signature isi file. */
export function getImageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: "png", mime: "image/png" };
  }

  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { extension: "jpg", mime: "image/jpeg" };
  }

  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", mime: "image/webp" };
  }

  throw new Error("Foto harus berupa JPG, PNG, atau WebP.");
}

/** Membaca upload gambar setelah memvalidasi ukuran dan jenis file. */
export async function readImageUpload(file, { maxSize = MAX_IMAGE_UPLOAD_SIZE } = {}) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    throw new Error("Foto wajib diunggah.");
  }

  if (file.size > maxSize) {
    throw new Error(`Ukuran foto maksimal ${maxSize / (1024 * 1024)} MB.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (bytes.length > maxSize) {
    throw new Error(`Ukuran foto maksimal ${maxSize / (1024 * 1024)} MB.`);
  }

  const type = getImageType(bytes);

  return { bytes, ...type };
}
