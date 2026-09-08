const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;
const MAX_NIK_LENGTH = 20;

export function stripInvisibleCharacters(value) {
  return String(value ?? "").replace(INVISIBLE_CHARACTERS, "");
}

export function normalizeNik(value) {
  const nik = stripInvisibleCharacters(value).trim();

  if (nik.length > MAX_NIK_LENGTH) {
    throw new Error(`NIK maksimal ${MAX_NIK_LENGTH} karakter.`);
  }

  return nik;
}
