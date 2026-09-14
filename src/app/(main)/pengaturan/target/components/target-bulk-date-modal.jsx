"use client";

import { useId, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CalendarRangeIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import OptionDropdown from "@/components/option-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function get_period_key(start_date, end_date) {
  return `${start_date}|${end_date}`;
}

export default function TargetBulkDateModal({
  open,
  date_mode,
  is_updating,
  target_label,
  entity_label = "outlet",
  rows,
  enable_target_update = false,
  on_open_change,
  on_submit,
}) {
  const field_id = useId();
  const periods = useMemo(() => {
    const period_map = new Map();

    for (const row of rows) {
      const key = get_period_key(row.start_date, row.end_date);
      const current_period = period_map.get(key);

      if (current_period) {
        current_period.count += 1;
        continue;
      }

      period_map.set(key, {
        key,
        start_date: row.start_date,
        end_date: row.end_date,
        range_label: row.range_label,
        count: 1,
        targets: new Set([Number(row.target ?? 0)]),
      });
    }

    for (const row of rows) {
      const key = get_period_key(row.start_date, row.end_date);
      const current_period = period_map.get(key);

      current_period?.targets.add(Number(row.target ?? 0));
    }

    return Array.from(period_map.values()).sort((first_period, second_period) =>
      second_period.start_date.localeCompare(first_period.start_date) ||
      second_period.end_date.localeCompare(first_period.end_date),
    );
  }, [rows]);
  const period_options = useMemo(
    () =>
      periods.map((period) => ({
        value: period.key,
        label: `${period.range_label} (${period.count} ${entity_label})`,
      })),
    [entity_label, periods],
  );
  const is_range_mode = date_mode === "range";
  const [selected_period_key, setSelectedPeriodKey] = useState(
    periods[0]?.key ?? "",
  );
  const [start_date, setStartDate] = useState(
    periods[0]?.start_date ?? "",
  );
  const [end_date, setEndDate] = useState(
    is_range_mode
      ? periods[0]?.end_date ?? ""
      : periods[0]?.start_date ?? "",
  );
  const [target, setTarget] = useState(() => {
    const target_values = Array.from(periods[0]?.targets ?? []);

    return target_values.length === 1 ? String(target_values[0]) : "";
  });
  const selected_period = periods.find(
    (period) => period.key === selected_period_key,
  );

  const handle_period_change = (next_key) => {
    const next_period = periods.find((period) => period.key === next_key);

    setSelectedPeriodKey(next_key);

    if (next_period) {
      const target_values = Array.from(next_period.targets ?? []);

      setStartDate(next_period.start_date);
      setEndDate(is_range_mode ? next_period.end_date : next_period.start_date);
      setTarget(target_values.length === 1 ? String(target_values[0]) : "");
    }
  };

  const handle_close = (next_open) => {
    if (!next_open && !is_updating) {
      setSelectedPeriodKey(periods[0]?.key ?? "");
      setStartDate(periods[0]?.start_date ?? "");
      setEndDate(
        is_range_mode
          ? periods[0]?.end_date ?? ""
          : periods[0]?.start_date ?? "",
      );
      const target_values = Array.from(periods[0]?.targets ?? []);

      setTarget(target_values.length === 1 ? String(target_values[0]) : "");
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
                Edit Massal
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Ubah tanggal seluruh {entity_label} pada periode {target_label} yang dipilih.
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

              if (!selected_period) {
                return;
              }

              on_submit({
                source_start_date: selected_period.start_date,
                source_end_date: selected_period.end_date,
                start_date,
                end_date: is_range_mode ? end_date : start_date,
                ...(enable_target_update ? { target } : {}),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${field_id}-periode-lama`}>
                {is_range_mode ? "Range Tanggal Lama" : "Tanggal Lama"}
              </Label>
              <OptionDropdown
                id={`${field_id}-periode-lama`}
                value={selected_period_key}
                options={period_options}
                onValueChange={handle_period_change}
                ariaLabel={`Pilih ${is_range_mode ? "range tanggal" : "tanggal"} lama ${target_label}`}
                searchable
                searchPlaceholder={
                  is_range_mode ? "Cari range tanggal..." : "Cari tanggal..."
                }
                emptyMessage={
                  is_range_mode
                    ? "Range tanggal tidak ditemukan."
                    : "Tanggal tidak ditemukan."
                }
              />
            </div>

            {is_range_mode ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${field_id}-tanggal-mulai-baru`}>
                    Tanggal Mulai Baru
                  </Label>
                  <Input
                    id={`${field_id}-tanggal-mulai-baru`}
                    type="date"
                    value={start_date}
                    onChange={(event) => setStartDate(event.target.value)}
                    disabled={is_updating}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${field_id}-tanggal-selesai-baru`}>
                    Tanggal Selesai Baru
                  </Label>
                  <Input
                    id={`${field_id}-tanggal-selesai-baru`}
                    type="date"
                    value={end_date}
                    onChange={(event) => setEndDate(event.target.value)}
                    disabled={is_updating}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`${field_id}-tanggal-baru`}>Tanggal Baru</Label>
                <Input
                  id={`${field_id}-tanggal-baru`}
                  type="date"
                  value={start_date}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={is_updating}
                  required
                />
              </div>
            )}

            {enable_target_update ? (
              <div className="space-y-2">
                <Label htmlFor={`${field_id}-target-baru`}>
                  Target Baru
                </Label>
                <Input
                  id={`${field_id}-target-baru`}
                  type="number"
                  min="0"
                  step="1"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder="Masukkan nilai target"
                  disabled={is_updating}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Nilai ini akan diterapkan ke seluruh {entity_label} pada periode lama yang dipilih.
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button type="submit">
                {is_updating ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CalendarRangeIcon className="size-4" />
                    Simpan Perubahan
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
