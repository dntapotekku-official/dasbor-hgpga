import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";

const exec_file = promisify(execFile);
const invalid_excel_format_message =
  "Format Excel tidak sesuai yang diharapkan. Pastikan file .xlsx memiliki kolom outlet dan target.";

export function normalize_target_outlet_name(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\(ho\)\s*$/, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

export function parse_target_date(date, {
  label = "Tanggal target",
} = {}) {
  const trimmed_date = String(date ?? "").trim();

  if (!trimmed_date) {
    throw new Error(`${label} wajib diisi.`);
  }

  const parsed_date = new Date(`${trimmed_date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed_date.getTime()) ||
    parsed_date.toISOString().slice(0, 10) != trimmed_date
  ) {
    throw new Error(`${label} tidak valid.`);
  }

  return parsed_date;
}

export function assert_valid_range(start_date, end_date) {
  if (end_date < start_date) {
    throw new Error("Tanggal akhir tidak boleh lebih kecil dari tanggal awal.");
  }
}

export async function parse_target_report_workbook(file_path) {
  try {
    const parser_path = path.join(process.cwd(), "src/scripts/parse_target_report.py");
    const { stdout, stderr } = await exec_file("python3", [parser_path, file_path], {
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && stderr.trim()) {
      throw new Error(stderr.trim());
    }

    const payload = JSON.parse(stdout);

    if (!Array.isArray(payload?.rows)) {
      throw new Error("Format hasil pembacaan file target tidak valid.");
    }

    return payload.rows;
  } catch {
    throw new Error(invalid_excel_format_message);
  }
}

export async function get_target_outlet_maps() {
  const outlets = await prisma.tbl_outlet.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      uuid: true,
      name: true,
      kategori: true,
    },
  });

  return {
    outlet_by_uuid: new Map(outlets.map((item) => [item.uuid, item])),
    outlet_by_name: new Map(
      outlets.map((item) => [normalize_target_outlet_name(item.name), item]),
    ),
  };
}
