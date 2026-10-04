"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  FileCheck2Icon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FieldLabel from "@/components/field-label";

function get_today_value() {
  return new Date().toISOString().slice(0, 10);
}

export default function TargetImportModal({
  open,
  date_mode,
  is_importing,
  target_label,
  entity_label = "Outlet",
  action_label = "Impor",
  on_open_change,
  on_submit,
}) {
  const [import_date, setImportDate] = useState(get_today_value);
  const [start_date, setStartDate] = useState(get_today_value);
  const [end_date, setEndDate] = useState(get_today_value);
  const [file, setFile] = useState(null);
  const [file_error, setFileError] = useState("");
  const [is_dragging, setIsDragging] = useState(false);

  const is_range_mode = date_mode === "range";
  const title = `${action_label} ${target_label}`;
  const description = is_range_mode
    ? `Pilih tanggal mulai dan tanggal selesai, lalu upload file Excel berisi data ${entity_label} dan target untuk ${target_label}.`
    : `Pilih tanggal data, lalu upload file Excel berisi data ${entity_label} dan target untuk ${target_label}.`;

  const accepted_columns = entity_label === "Penempatan"
    ? "Gunakan kolom NIK atau InsanKU, kolom Outlet jika ada lebih dari satu penempatan, serta kolom target."
    : entity_label === "InsanKU"
      ? "Gunakan kolom NIK (disarankan) atau InsanKU, serta kolom target."
      : `Pastikan file memiliki kolom ${entity_label.toLowerCase()} dan target.`;

  const select_file = (next_file) => {
    if (!next_file) {
      setFile(null);
      return;
    }

    if (!next_file.name.toLowerCase().endsWith(".xlsx")) {
      setFile(null);
      setFileError("Format file tidak didukung. Gunakan file .xlsx.");
      return;
    }

    setFile(next_file);
    setFileError("");
  };

  const reset_form = () => {
    const today = get_today_value();

    setImportDate(today);
    setStartDate(today);
    setEndDate(today);
    setFile(null);
    setFileError("");
    setIsDragging(false);
  };

  const handle_close = (next_open) => {
    if (!next_open && !is_importing) {
      reset_form();
      on_open_change(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handle_close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                />
              }
            >
              <XIcon className="size-4" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>

          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              on_submit({
                import_date,
                start_date,
                end_date,
                file,
              });
            }}
          >
            {is_range_mode ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel htmlFor="tanggal-mulai-import-target" label="Tanggal Mulai" required />
                  <Input
                    id="tanggal-mulai-import-target"
                    type="date"
                    value={start_date}
                    onChange={(event) => setStartDate(event.target.value)}
                    disabled={is_importing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="tanggal-selesai-import-target" label="Tanggal Selesai" required />
                  <Input
                    id="tanggal-selesai-import-target"
                    type="date"
                    value={end_date}
                    onChange={(event) => setEndDate(event.target.value)}
                    disabled={is_importing}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <FieldLabel htmlFor="tanggal-import-target" label="Tanggal Data" required />
                <Input
                  id="tanggal-import-target"
                  type="date"
                  value={import_date}
                  onChange={(event) => setImportDate(event.target.value)}
                  disabled={is_importing}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <FieldLabel htmlFor="file-import-target" label="File Excel" required />
              <Input
                id="file-import-target"
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(event) => select_file(event.target.files?.[0] ?? null)}
                disabled={is_importing}
              />
              <label
                htmlFor="file-import-target"
                className={`group flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-7 text-center transition-colors ${
                  is_importing ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                } ${
                  is_dragging
                    ? "border-emerald-500 bg-emerald-50"
                    : file
                      ? "border-emerald-300 bg-emerald-50/60 hover:border-emerald-400"
                      : "border-border bg-muted/20 hover:border-emerald-400 hover:bg-emerald-50/40"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!is_importing) {
                    setIsDragging(true);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);

                  if (!is_importing) {
                    select_file(event.dataTransfer.files?.[0] ?? null);
                  }
                }}
              >
                <span
                  className={`mb-4 flex size-14 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:-translate-y-0.5 ${
                    file ? "bg-emerald-600 text-white" : "border bg-background text-emerald-700"
                  }`}
                >
                  {file ? (
                    <FileCheck2Icon className="size-7" />
                  ) : (
                    <UploadCloudIcon className="size-7" />
                  )}
                </span>
                <span className="max-w-full truncate font-heading text-base font-semibold">
                  {file ? file.name : "Tarik file Excel ke sini"}
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {file
                    ? `${(file.size / 1_048_576).toLocaleString("id-ID", {
                        maximumFractionDigits: 2,
                      })} MB - klik untuk mengganti file`
                    : "atau klik area ini untuk memilih file .xlsx"}
                </span>
              </label>
              {file_error ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {file_error}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {accepted_columns}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button
                type="submit"
                disabled={is_importing}
                aria-busy={is_importing}
              >
                {is_importing ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  <>
                    <FileSpreadsheetIcon className="size-4" />
                    {action_label}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
