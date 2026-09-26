"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ListPlusIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FieldLabel from "@/components/field-label";

export default function TargetBulkCreateModal({
  open,
  is_submitting,
  on_open_change,
  on_submit,
}) {
  const [start_date, setStartDate] = useState("");
  const [end_date, setEndDate] = useState("");
  const [target, setTarget] = useState("");

  const handle_submit = async (event) => {
    event.preventDefault();

    if (!start_date || !end_date || target === "") {
      toast.error("Range tanggal dan nilai target wajib diisi.");
      return;
    }

    if (start_date > end_date) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }

    await on_submit({ start_date, end_date, target });
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next_open) => {
        if (!is_submitting) on_open_change(next_open);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                Tambah Massal Target GoFitKu
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Terapkan satu target dan periode yang sama ke seluruh InsanKU aktif.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handle_submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="bulk-create-start-date" label="Tanggal Mulai" required />
                <Input
                  id="bulk-create-start-date"
                  type="date"
                  value={start_date}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={is_submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="bulk-create-end-date" label="Tanggal Selesai" required />
                <Input
                  id="bulk-create-end-date"
                  type="date"
                  value={end_date}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={is_submitting}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="bulk-create-target" label="Target" required />
              <Input
                id="bulk-create-target"
                type="number"
                min="0"
                step="1"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="Masukkan nilai target"
                disabled={is_submitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                Nilai ini akan diberikan kepada seluruh InsanKU aktif.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <DialogPrimitive.Close
                render={<Button type="button" variant="outline" />}
              >
                Batal
              </DialogPrimitive.Close>
              <Button type="submit" disabled={is_submitting}>
                {is_submitting ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <ListPlusIcon className="size-4" />
                )}
                {is_submitting ? "Menyimpan..." : "Simpan Target Massal"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
