"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ImagePlusIcon,
  LoaderCircleIcon,
  PlusIcon,
  ScanSearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import OptionDropdown from "@/components/option-dropdown";
import FieldLabel from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SalesEntryModal({
  open,
  active_outlet,
  sales_form,
  produk_options,
  is_scanning,
  is_saving,
  on_close,
  on_submit,
  on_image_upload,
  on_scan_images,
  on_remove_image,
  on_add_manual_entry,
  on_remove_entry,
  on_entry_change,
  on_product_change,
}) {
  const can_close = !is_scanning && !is_saving;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next_open) => {
        if (!next_open && can_close) {
          on_close();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl">
          <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold">
              Tambah Penjualan
            </DialogPrimitive.Title>
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

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={on_submit}>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="foto-penjualan"
                      className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center"
                    >
                      <ImagePlusIcon className="mb-3 size-7 text-muted-foreground" />
                      <div className="font-medium">Upload foto penjualan</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Bisa pilih lebih dari satu foto untuk discan sekaligus.
                      </div>
                    </label>
                    <Input
                      id="foto-penjualan"
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={on_image_upload}
                    />
                  </div>

                  <div className="rounded-lg border">
                    <div className="border-b px-4 py-3">
                      <div className="font-medium">Daftar Foto</div>
                    </div>
                    <div className="space-y-3 p-4">
                      {sales_form.uploaded_images.length ? (
                        sales_form.uploaded_images.map((image, index) => (
                          <div
                            key={image.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                Foto {index + 1}
                              </div>
                              <div className="truncate text-sm text-muted-foreground">
                                {image.name} - {image.size_label}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="delete"
                              size="icon-sm"
                              onClick={() => on_remove_image(image.id)}
                            >
                              <Trash2Icon className="size-4" />
                              <span className="sr-only">Hapus foto</span>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                          Foto akan tampil di sini setelah diupload.
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={on_scan_images}
                    className="w-full"
                    disabled={is_scanning || is_saving}
                    aria-busy={is_scanning}
                  >
                    {is_scanning ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : (
                      <ScanSearchIcon className="size-4" />
                    )}
                    Scan dengan AI
                  </Button>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Hasil Scan</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {sales_form.scan_status === "done"
                            ? "Hasil scan sudah masuk. Data tetap bisa diubah sebelum disimpan."
                            : "Form manual juga bisa ditambahkan tanpa scan foto."}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={on_add_manual_entry}
                      >
                        <PlusIcon className="size-4" />
                        Tambah Entri
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-[480px] space-y-4 overflow-auto p-4">
                    {sales_form.scanned_entries.map((entry, index) => (
                      <div key={entry.id} className="rounded-lg border bg-card">
                        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                          <div className="font-medium">Entri {index + 1}</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="delete"
                              size="sm"
                              onClick={() => on_remove_entry(entry.id)}
                            >
                              <Trash2Icon className="size-4" />
                              Hapus
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-2">
                            <FieldLabel htmlFor={`tanggal-penjualan-${entry.id}`} label="Tanggal" required />
                            <Input
                              id={`tanggal-penjualan-${entry.id}`}
                              type="date"
                              value={entry.date}
                              onChange={(event) =>
                                on_entry_change(entry.id, "date", event.target.value)
                              }
                              className="bg-card"
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor={`insanku-penjualan-${entry.id}`} label="Nama" required />
                            <OptionDropdown
                              id={`insanku-penjualan-${entry.id}`}
                              value={entry.employee_uuid}
                              options={(active_outlet?.rows ?? [])
                                .filter((row) => row.is_active)
                                .map((row) => ({
                                  value: row.uuid,
                                  label: row.name,
                                }))}
                              onValueChange={(employee_uuid) =>
                                on_entry_change(entry.id, "employee_uuid", employee_uuid)
                              }
                              ariaLabel={`Nama InsanKu entri ${index + 1}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel htmlFor={`produk-penjualan-${entry.id}`} label="Produk" required />
                            <OptionDropdown
                              id={`produk-penjualan-${entry.id}`}
                              value={entry.produk_uuid ?? ""}
                              options={produk_options}
                              onValueChange={(produk_uuid) =>
                                on_product_change(entry.id, produk_uuid)
                              }
                              ariaLabel={`Produk GoFitKu entri ${index + 1}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <FieldLabel
                              htmlFor={`jumlah-penjualan-${entry.id}`}
                              label="Jumlah"
                              required
                            />
                            <Input
                              id={`jumlah-penjualan-${entry.id}`}
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={entry.sales_total}
                              onChange={(event) =>
                                on_entry_change(entry.id, "sales_total", event.target.value)
                              }
                              placeholder="Masukkan jumlah"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 pt-4">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button
                type="submit"
                disabled={is_saving || is_scanning}
                aria-busy={is_saving}
              >
                {is_saving ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : null}
                Simpan
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
