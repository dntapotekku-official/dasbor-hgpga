"use client";

import { useId, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  CalendarRangeIcon,
  LoaderCircleIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import OptionDropdown from "@/components/option-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function format_date_label(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function MetricBulkActionModal({
  open,
  action,
  metric_label,
  dates,
  default_date,
  is_processing,
  on_open_change,
  on_submit,
}) {
  const field_id = useId();
  const is_edit = action === "edit_date";
  const date_options = useMemo(
    () => dates.map((date) => ({ value: date, label: format_date_label(date) })),
    [dates],
  );
  const initial_date = dates.includes(default_date) ? default_date : dates[0] ?? "";
  const [source_date, setSourceDate] = useState(initial_date);
  const [target_date, setTargetDate] = useState("");

  const handle_close = (next_open) => {
    if (!next_open && !is_processing) {
      on_open_change(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handle_close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5 text-popover-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                {is_edit ? "Edit Massal Tanggal" : "Hapus Massal"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {is_edit
                  ? `Pindahkan seluruh data ${metric_label} dari tanggal lama ke tanggal baru.`
                  : `Hapus seluruh data ${metric_label} pada tanggal yang dipilih.`}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={is_processing}
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
              on_submit({ source_date, target_date });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${field_id}-tanggal-data`}>
                {is_edit ? "Tanggal Lama" : "Tanggal Data"}
              </Label>
              <OptionDropdown
                id={`${field_id}-tanggal-data`}
                value={source_date}
                options={date_options}
                onValueChange={setSourceDate}
                ariaLabel={`Pilih tanggal ${metric_label}`}
                disabled={is_processing}
                searchable
                searchPlaceholder="Cari tanggal..."
                emptyMessage="Tanggal data tidak ditemukan."
              />
            </div>

            {is_edit ? (
              <div className="space-y-2">
                <Label htmlFor={`${field_id}-tanggal-baru`}>Tanggal Baru</Label>
                <Input
                  id={`${field_id}-tanggal-baru`}
                  type="date"
                  value={target_date}
                  onChange={(event) => setTargetDate(event.target.value)}
                  disabled={is_processing}
                  required
                />
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Seluruh data outlet pada tanggal terpilih akan dihapus permanen.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" disabled={is_processing} />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button
                type="submit"
                variant={is_edit ? "default" : "delete"}
                disabled={
                  is_processing || !source_date || (is_edit && !target_date)
                }
              >
                {is_processing ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Memproses...
                  </>
                ) : is_edit ? (
                  <>
                    <CalendarRangeIcon className="size-4" />
                    Simpan
                  </>
                ) : (
                  <>
                    <Trash2Icon className="size-4" />
                    Hapus Massal
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
