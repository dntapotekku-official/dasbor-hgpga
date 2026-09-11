"use client";

import { useId, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, Trash2Icon, XIcon } from "lucide-react";

import OptionDropdown from "@/components/option-dropdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function get_period_key(start_date, end_date) {
  return `${start_date}|${end_date}`;
}

export default function TargetBulkDeleteModal({
  open,
  is_deleting,
  target_label,
  entity_label = "outlet",
  rows,
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
      });
    }

    return Array.from(period_map.values());
  }, [rows]);
  const period_options = useMemo(
    () =>
      periods.map((period) => ({
        value: period.key,
        label: `${period.range_label} (${period.count} ${entity_label})`,
      })),
    [entity_label, periods],
  );
  const [selected_period_key, setSelectedPeriodKey] = useState(
    periods[0]?.key ?? "",
  );
  const selected_period = periods.find(
    (period) => period.key === selected_period_key,
  );

  const handle_close = (next_open) => {
    if (!next_open && !is_deleting) {
      setSelectedPeriodKey(periods[0]?.key ?? "");
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
                Hapus Massal Target
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Hapus seluruh data {target_label} pada periode yang dipilih.
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
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${field_id}-periode-hapus`}>Periode Target</Label>
              <OptionDropdown
                id={`${field_id}-periode-hapus`}
                value={selected_period_key}
                options={period_options}
                onValueChange={setSelectedPeriodKey}
                ariaLabel={`Pilih periode ${target_label} yang akan dihapus`}
                searchable
                searchPlaceholder="Cari periode..."
                emptyMessage="Periode tidak ditemukan."
              />
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
                variant="delete"
              >
                {is_deleting ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Menghapus...
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
