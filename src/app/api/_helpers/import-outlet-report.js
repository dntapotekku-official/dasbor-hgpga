import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireMenuAccess } from "@/lib/auth";

export async function import_outlet_report(request, {
  import_handler,
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

    if (!(file instanceof File)) {
      throw new Error("File Excel wajib dipilih.");
    }

    const file_name = String(file.name ?? "").trim();

    if (!file_name.toLowerCase().endsWith(".xlsx")) {
      throw new Error("File yang didukung hanya format .xlsx.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    temp_file_path = path.join(
      os.tmpdir(),
      `${temp_prefix}-${Date.now()}-${file_name.replace(/[^a-z0-9._-]/gi, "_")}`,
    );
    await fs.writeFile(temp_file_path, bytes);

    const result = await import_handler({
      file_path: temp_file_path,
      import_date,
      ...handler_payload,
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
