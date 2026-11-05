"use client";

/* eslint-disable @next/next/no-img-element -- Foto GCS publik dan preview blob ditampilkan langsung tanpa proxy optimasi. */

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  LoaderCircleIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatKegiatanDuration } from "@/lib/kegiatanDuration";
import { Button } from "@/components/ui/button";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Membaca respons JSON API dan melempar pesan bila permintaan gagal. */
async function read_response(response) {
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new Error(result.message ?? "Gagal memproses kegiatan.");
  return result;
}

/** Menampilkan kegiatan serta form tambah, edit, konfirmasi hapus, dan preview foto. */
export default function KegiatanDetail({ placement, period }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [load_error, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing_photo, setViewingPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(Number(period.year), Number(period.month), 0))
    .toISOString()
    .slice(0, 10);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      id: placement.id,
      month: period.month,
      year: period.year,
    });
    fetch(`/api/jam-kerja-insanku/kegiatan?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(read_response)
      .then((result) => {
        setRows(result.data);
        setLoadError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [placement.id, period.month, period.year, reload]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  /** Memperbarui file foto terpilih dan URL preview sementara pada form. */
  function choose_photo(file) {
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  /** Mengirim form tambah atau edit kegiatan dan memperbarui baris tabel setelah berhasil. */
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!photo && !editing?.img_url) {
      toast.error("Foto kegiatan wajib diunggah.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("id", placement.id);
    form.set("month", period.month);
    form.set("year", period.year);
    if (photo) form.set("photo", photo);
    else form.delete("photo");
    if (editing) form.set("uuid", editing.uuid);
    setSaving(true);
    try {
      const result = await read_response(
        await fetch("/api/jam-kerja-insanku/kegiatan", {
          method: editing ? "PATCH" : "POST",
          body: form,
        }),
      );
      setRows((current) =>
        [
          ...current.filter((row) => row.uuid !== result.data.uuid),
          result.data,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      );
      setLoadError("");
      setOpen(false);
      choose_photo(null);
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  /** Menghapus kegiatan terpilih melalui API setelah pengguna mengonfirmasi. */
  async function remove_activity() {
    if (saving || !deleting) return;
    setSaving(true);
    try {
      const result = await read_response(
        await fetch("/api/jam-kerja-insanku/kegiatan", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uuid: deleting.uuid,
            id: placement.id,
            month: period.month,
            year: period.year,
          }),
        }),
      );
      setRows((current) => current.filter((row) => row.uuid !== result.uuid));
      setDeleting(null);
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            setEditing(null);
            choose_photo(null);
            setOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Tambah Kegiatan
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table aria-label="Kegiatan jam kerja" fixedColumns="none">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Foto</TableHead>
              <TableHead className="text-right">Durasi (jam.menit)</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || load_error || !rows.length ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-28 text-center text-muted-foreground"
                >
                  {loading ? (
                    "Memuat kegiatan..."
                  ) : load_error ? (
                    <div className="space-y-2">
                      <p role="alert">{load_error}</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setLoading(true);
                          setReload((current) => current + 1);
                        }}
                      >
                        Coba lagi
                      </Button>
                    </div>
                  ) : (
                    "Belum ada kegiatan pada periode ini."
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row.uuid}>
                  <TableCell className="text-center">{index + 1}</TableCell>
                  <TableCell>
                    {new Date(`${row.date}T00:00:00Z`).toLocaleDateString(
                      "id-ID",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      },
                    )}
                  </TableCell>
                  <TableCell className="min-w-64 max-w-lg whitespace-pre-wrap break-words">
                    {row.description}
                  </TableCell>
                  <TableCell>
                    {row.img_url ? (
                      <button
                        type="button"
                        onClick={() => setViewingPhoto(row)}
                        className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Buka foto kegiatan tanggal ${row.date}`}
                      >

                        <img
                          src={row.img_url}
                          alt={`Foto kegiatan tanggal ${row.date}`}
                          className="h-16 w-24 rounded-md border object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatKegiatanDuration(row.hours_value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setEditing(row);
                          choose_photo(null);
                          setOpen(true);
                        }}
                        aria-label={`Edit kegiatan tanggal ${row.date}`}
                      >
                        <PencilIcon className="size-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="delete"
                        size="sm"
                        disabled={saving}
                        onClick={() => setDeleting(row)}
                        aria-label={`Hapus kegiatan tanggal ${row.date}`}
                      >
                        <Trash2Icon className="size-4" />
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!saving) {
            setOpen(value);
            if (!value) choose_photo(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg" showCloseButton={!saving}>
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit Kegiatan" : "Tambah Kegiatan"}
            </SheetTitle>
          </SheetHeader>
          <form
            key={`${editing?.uuid ?? "new"}-${open}`}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={submit}
          >
            <fieldset
              disabled={saving}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4"
            >
              <div className="space-y-2">
                <label htmlFor="kegiatan-date" className="text-sm font-medium">
                  Tanggal
                </label>
                <Input
                  id="kegiatan-date"
                  name="date"
                  type="date"
                  required
                  min={start}
                  max={end}
                  defaultValue={editing?.date ?? start}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="kegiatan-description"
                  className="text-sm font-medium"
                >
                  Deskripsi
                </label>
                <textarea
                  id="kegiatan-description"
                  name="description"
                  defaultValue={editing?.description ?? ""}
                  required
                  maxLength={10000}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Tuliskan kegiatan yang dilakukan..."
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="kegiatan-photo" className="text-sm font-medium">
                  Foto kegiatan
                </label>
                <Input
                  id="kegiatan-photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={!editing?.img_url}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (
                      file &&
                      (!["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      ) ||
                        file.size > 5 * 1024 * 1024)
                    ) {
                      toast.error(
                        "Pilih foto JPG, PNG, atau WebP maksimal 5 MB.",
                      );
                      event.target.value = "";
                      choose_photo(null);
                      return;
                    }
                    choose_photo(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, atau WebP. Maksimal 5 MB.
                  {editing?.img_url
                    ? " Kosongkan jika foto tidak diganti."
                    : ""}
                </p>

                {(preview || editing?.img_url) && (
                  <img
                    src={preview || editing.img_url}
                    alt="Preview foto kegiatan"
                    className="max-h-64 w-full rounded-lg border object-contain"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="kegiatan-hours" className="text-sm font-medium">
                  Durasi (jam.menit)
                </label>
                <Input
                  id="kegiatan-hours"
                  name="hours_value"
                  type="text"
                  inputMode="decimal"
                  defaultValue={
                    editing ? formatKegiatanDuration(editing.hours_value) : ""
                  }
                  required
                  pattern="[0-9]+([.][0-9]{1,2})?"
                  placeholder="Contoh: 1.30"
                  aria-describedby="kegiatan-hours-help"
                />
                <p
                  id="kegiatan-hours-help"
                  className="text-xs text-muted-foreground"
                >
                  Format jam.menit: 1.30 = 1 jam 30 menit; 0.15 = 15 menit.
                  Bagian menit 00–59.
                </p>
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setOpen(false);
                  choose_photo(null);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircleIcon className="size-4 animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan Kegiatan"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <DialogPrimitive.Root
        open={!!viewing_photo}
        onOpenChange={(value) => {
          if (!value) setViewingPhoto(null);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 supports-backdrop-filter:backdrop-blur-xs" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-heading text-lg font-semibold">
                  Foto Kegiatan
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {viewing_photo
                    ? new Date(
                      `${viewing_photo.date}T00:00:00Z`,
                    ).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                    : ""}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                render={<Button type="button" variant="ghost" size="icon-sm" />}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Tutup foto</span>
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 overflow-auto p-4">

              {viewing_photo && (
                <img
                  src={viewing_photo.img_url}
                  alt={`Foto kegiatan tanggal ${viewing_photo.date}`}
                  className="mx-auto max-h-[75dvh] max-w-full rounded-md object-contain"
                />
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <ConfirmActionDialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value && !saving) setDeleting(null);
        }}
        title="Hapus Kegiatan"
        description={`Hapus kegiatan tanggal ${deleting?.date ?? ""}: ${deleting?.description ?? ""}?`}
        confirmLabel="Hapus Kegiatan"
        confirmVariant="delete"
        isPending={saving}
        onConfirm={remove_activity}
      />
    </div>
  );
}
