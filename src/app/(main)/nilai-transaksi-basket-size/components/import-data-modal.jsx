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
import { Label } from "@/components/ui/label";

export default function ImportDataModal({
  default_date,
  import_type,
  is_importing,
  on_open_change,
  on_submit,
}) {
  const [import_date, setImportDate] = useState(default_date);
  const [file, setFile] = useState(null);
  const [file_error, setFileError] = useState("");
  const [is_dragging, setIsDragging] = useState(false);

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

  const title =
    import_type === "basket-size" ? "Impor Basket Size" : "Impor Nilai Transaksi";
  const description =
    import_type === "basket-size"
      ? "Tentukan tanggal data, lalu pilih file ikhtisar outlet untuk mengimpor basket size."
      : "Tentukan tanggal data, lalu pilih file ikhtisar outlet untuk mengimpor nilai transaksi.";
  const date_input_id =
    import_type === "basket-size"
      ? "tanggal-import-basket-size"
      : "tanggal-import-nilai-transaksi";
  const file_input_id =
    import_type === "basket-size"
      ? "file-import-basket-size"
      : "file-import-nilai-transaksi";

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(next_open) => {
        if (!next_open && !is_importing) {
          on_open_change(false);
        }
      }}
    >
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
                  disabled={is_importing}
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
              on_submit({ import_date: import_date, file, import_type });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={date_input_id}>Tanggal Data</Label>
              <Input
                id={date_input_id}
                type="date"
                value={import_date}
                onChange={(event) => setImportDate(event.target.value)}
                disabled={is_importing}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={file_input_id}>File Excel</Label>
              <Input
                id={file_input_id}
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(event) => select_file(event.target.files?.[0] ?? null)}
                disabled={is_importing}
              />
              <label
                htmlFor={file_input_id}
                className={`group flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
                  is_importing
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer"
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
                    file
                      ? "bg-emerald-600 text-white"
                      : "border bg-background text-emerald-700"
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
                  Pastikan file memiliki sheet Laporan Penjualan dan Statistik
                  Kunjungan.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" disabled={is_importing} />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button type="submit" disabled={is_importing || !import_date || !file}>
                {is_importing ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Mengimpor...
                  </>
                ) : (
                  <>
                    <FileSpreadsheetIcon className="size-4" />
                    Impor
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
