import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";

const max_excel_file_size = 10 * 1024 * 1024;

export async function import_outlet_report(request, {
  import_handler,
  resolve_import_handler,
  menu_key,
  temp_prefix,
  fallback_roles = ["admin"],
  handler_payload = {},
}) {
  let temp_file_path = "";

  try {
    const unauthorized_response = await requireMenuAccess(menu_key, fallback_roles);

    if (unauthorized_response) {
      return unauthorized_response;
    }

    const form_data = await request.formData();
    const file = form_data.get("file");
    const import_date = form_data.get("import_date");
    const resolved_import_handler = resolve_import_handler
      ? resolve_import_handler(form_data)
      : import_handler;
    const resolved_handler_payload = typeof handler_payload === "function"
      ? handler_payload(form_data)
      : handler_payload;

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

    const result = await resolved_import_handler({
      file_path: temp_file_path,
      import_date,
      ...resolved_handler_payload,
    });

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
