"use client";

import { useId, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  CalendarRangeIcon,
  LoaderCircleIcon,
  MoveRightIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import OptionDropdown from "@/components/option-dropdown";
import FieldLabel from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function format_range_label(range) {
  if (!range?.from_date || !range?.to_date) {
    return "";
  }

  return `${format_date_label(range.from_date)} - ${format_date_label(range.to_date)}`;
}

export default function MetricBulkActionModal({
  open,
  action,
  metric_label,
  period = "daily",
  dates = [],
  default_date,
  is_processing,
  on_open_change,
  on_submit,
}) {
  const field_id = useId();
  const is_edit = action === "edit_date";
  const is_monthly = period === "monthly";
  const period_label = is_monthly ? "Rentang" : "Harian";
  const source_date_label = is_monthly ? "Rentang Periode" : "Tanggal Data";
  const source_edit_label = is_monthly ? "Rentang Periode Lama" : "Tanggal Lama";
  const date_options = useMemo(
    () => {
      if (is_monthly) {
        return dates
          .filter((range) => range?.from_date && range?.to_date)
          .map((range) => ({
            value: `${range.from_date}:${range.to_date}`,
            label: format_range_label(range),
          }))
          .sort((first_range, second_range) =>
            second_range.value.localeCompare(first_range.value),
          );
      }

      return [...dates]
        .sort((first_date, second_date) => second_date.localeCompare(first_date))
        .map((date) => ({ value: date, label: format_date_label(date) }));
    },
    [dates, is_monthly],
  );
  const sorted_dates = useMemo(
    () => date_options.map((option) => option.value),
    [date_options],
  );
  const initial_date = sorted_dates.includes(default_date)
    ? default_date
    : sorted_dates[0] ?? "";
  const [source_date, setSourceDate] = useState(initial_date);
  const [target_date, setTargetDate] = useState("");
  const [target_from_date, setTargetFromDate] = useState("");
  const [target_to_date, setTargetToDate] = useState("");

  const handle_close = (next_open) => {
    if (!next_open && !is_processing) {
      setSourceDate(initial_date);
      setTargetDate("");
      setTargetFromDate("");
      setTargetToDate("");
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
                {is_edit
                  ? `Edit Massal (${period_label})`
                  : `Hapus Massal (${period_label})`}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {is_edit
                  ? `Pindahkan seluruh data ${metric_label} ${period_label.toLowerCase()} dari tanggal lama ke tanggal baru.`
                  : `Hapus seluruh data ${metric_label} ${period_label.toLowerCase()} pada tanggal yang dipilih.`}
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
              const [source_from_date, source_to_date] = source_date.split(":");
              on_submit({
                source_date,
                target_date,
                source_from_date,
                source_to_date,
                target_from_date,
                target_to_date,
              });
            }}
          >
            <div className="space-y-2">
              <FieldLabel
                htmlFor={`${field_id}-tanggal-data`}
                label={is_edit ? source_edit_label : source_date_label}
                required
              />
              <OptionDropdown
                id={`${field_id}-tanggal-data`}
                value={source_date}
                options={date_options}
                onValueChange={setSourceDate}
                ariaLabel={`Pilih tanggal ${metric_label}`}
                searchable
                searchPlaceholder="Cari tanggal..."
                emptyMessage="Tanggal data tidak ditemukan."
              />
            </div>

            {is_edit ? (
              <div className="space-y-2">
                {is_monthly ? (
                  <>
                    <FieldLabel
                      htmlFor={`${field_id}-tanggal-baru-dari`}
                      label="Rentang Tanggal"
                      required
                    />
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                      <Input
                        id={`${field_id}-tanggal-baru-dari`}
                        type="date"
                        value={target_from_date}
                        onChange={(event) => setTargetFromDate(event.target.value)}
                        disabled={is_processing}
                        required
                      />
                      <div className="flex items-center justify-center text-muted-foreground">
                        <MoveRightIcon className="size-4 rotate-90 sm:rotate-0" />
                        <span className="sr-only">sampai</span>
                      </div>
                      <Input
                        id={`${field_id}-tanggal-baru-sampai`}
                        type="date"
                        value={target_to_date}
                        onChange={(event) => setTargetToDate(event.target.value)}
                        disabled={is_processing}
                        min={target_from_date || undefined}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <FieldLabel
                      htmlFor={`${field_id}-tanggal-baru`}
                      label="Tanggal Baru"
                      required
                    />
                    <Input
                      id={`${field_id}-tanggal-baru`}
                      type="date"
                      value={target_date}
                      onChange={(event) => setTargetDate(event.target.value)}
                      disabled={is_processing}
                      required
                    />
                  </>
                )}
              </div>
            ) : ''}

            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button
                type="submit"
                variant={is_edit ? "default" : "delete"}
                disabled={is_processing}
                aria-busy={is_processing}
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
