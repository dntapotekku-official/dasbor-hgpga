const DEFAULT_ERROR_MESSAGE = "Terjadi kesalahan pada server.";

function getPrismaErrorCode(error) {
  return typeof error?.code === "string" ? error.code : "";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "";
}

function getUniqueTarget(error) {
  const target = error?.meta?.target ?? error?.meta?.constraint;

  if (Array.isArray(target)) {
    return target.join(", ");
  }

  return typeof target === "string" ? target : "";
}

export function getFriendlyApiErrorMessage(
  error,
  fallback_message = DEFAULT_ERROR_MESSAGE,
) {
  const code = getPrismaErrorCode(error);
  const message = getErrorMessage(error);
  const unique_target = getUniqueTarget(error).toLowerCase();

  if (code === "P2002") {
    if (unique_target.includes("username")) {
      return "Username sudah digunakan oleh akun lain.";
    }

    if (unique_target.includes("nik")) {
      return "NIK sudah terdaftar pada kategori akun yang sama.";
    }

    return "Data tidak dapat disimpan karena ada data unik yang sudah digunakan.";
  }

  if (code === "P2003" || message.includes("Foreign key constraint violated")) {
    return "Data relasi belum lengkap. Pastikan master outlet dan InsanKu sudah disinkronkan terlebih dahulu.";
  }

  if (message.includes("Environment variable")) {
    return "Konfigurasi sinkronisasi belum lengkap. Periksa pengaturan API di environment.";
  }

  if (message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return "Gagal menghubungi API sumber data. Periksa koneksi atau konfigurasi API.";
  }

  if (message.includes("Unique constraint failed")) {
    return "Data tidak dapat disimpan karena ada data unik yang sudah digunakan.";
  }

  if (message.includes("Invalid `") || message.includes("invocation")) {
    return fallback_message;
  }

  return message || fallback_message;
}

export function buildApiErrorResponse(error, fallback_message) {
  return {
    success: false,
    message: getFriendlyApiErrorMessage(error, fallback_message),
  };
}
