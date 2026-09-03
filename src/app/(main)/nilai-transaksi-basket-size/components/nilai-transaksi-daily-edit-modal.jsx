"use client";

import { useId, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NilaiTransaksiDailyEditModal({
  open,
  row,
  selected_date,
  is_saving,
  on_open_change,
  on_submit,
}) {
  const field_id = useId();
  const [totalRevenue, setTotalRevenue] = useState(
    String(row?.total_revenue ?? 0),
  );

  const handle_close = (next_open) => {
    if (!next_open && !is_saving) {
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
                Edit Data Nilai Transaksi
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Ubah data mentah {row?.outlet_name ?? "outlet"} pada {selected_date}.
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
                total_revenue: totalRevenue,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${field_id}-total-revenue`}>
                Total Penerimaan Pendapatan
              </Label>
              <Input
                id={`${field_id}-total-revenue`}
                type="number"
                min="0"
                step="0.01"
                value={totalRevenue}
                onChange={(event) => setTotalRevenue(event.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button type="submit">
                {is_saving ? (
                  <>
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
