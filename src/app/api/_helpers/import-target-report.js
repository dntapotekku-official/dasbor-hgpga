import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";

const max_excel_file_size = 10 * 1024 * 1024;

export async function import_target_report(request, {
  import_handler,
  temp_prefix,
  field_names = [],
}) {
  let temp_file_path = "";

  try {
    const unauthorized_response = await requireMenuAccess("pengaturan-target");

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const form_data = await request.formData();
    const file = form_data.get("file");

    if (!(file instanceof File)) {
      throw new Error("File Excel wajib dipilih.");
    }

    const file_name = String(file.name ?? "").trim();

    if (!file_name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("File yang didukung hanya format .xlsx.");
    }

    if (file.size > max_excel_file_size) {
      throw new Error("Ukuran file Excel maksimal 10 MB.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    temp_file_path = path.join(
      os.tmpdir(),
      `${temp_prefix}-${Date.now()}-${file_name.replace(/[^a-z0-9._-]/gi, "_")}`,
    );
    await fs.writeFile(temp_file_path, bytes);

    const payload = {
      file_path: temp_file_path,
    };

    field_names.forEach((field_name) => {
      payload[field_name] = form_data.get(field_name);
    });

    const result = await import_handler(payload);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
      },
      { status: 400 },
    );
  } finally {
    if (temp_file_path) {
      await fs.unlink(temp_file_path).catch(() => undefined);
    }
  }
}
