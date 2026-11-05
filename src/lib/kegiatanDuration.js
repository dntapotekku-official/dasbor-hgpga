/** Input jam.menit; database menyimpan durasi sebagai jumlah jam numerik. */
export function parseKegiatanDuration(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? "").trim());
  if (!match) throw new Error("Durasi harus memakai format jam.menit, misalnya 1.30 untuk 1 jam 30 menit.");
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const total_minutes = hours * 60 + minutes;
  if (minutes > 59 || !Number.isSafeInteger(total_minutes) || total_minutes <= 0) throw new Error("Durasi harus lebih dari 0 dan bagian menit harus antara 00–59.");
  return total_minutes / 60;
}

/** Mengubah jumlah jam numerik menjadi teks jam.menit untuk form dan tabel. */
export function formatKegiatanDuration(value) {
  const total_minutes = Math.round(Number(value) * 60);
  return `${Math.floor(total_minutes / 60)}.${String(total_minutes % 60).padStart(2, "0")}`;
}
