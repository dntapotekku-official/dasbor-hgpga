"use client";

import { useId, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";

import FieldLabel from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BasketSizeSkuEditModal({
  open,
  row,
  selected_date,
  is_saving,
  on_open_change,
  on_submit,
}) {
  const field_id = useId();
  const initial_sku_qty = row?.bs_current_month_sku_qty ?? 0;
  const initial_kunjungan = row?.bs_current_month_kunjungan ?? 0;
  const [skuQty, setSkuQty] = useState(String(initial_sku_qty));
  const [kunjungan, setKunjungan] = useState(String(initial_kunjungan));

  const handle_close = (next_open) => {
    if (!next_open && !is_saving) {
      setSkuQty(String(initial_sku_qty));
      setKunjungan(String(initial_kunjungan));
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
                Edit Jumlah SKU
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Ubah Jumlah SKU {row?.outlet_name ?? "outlet"} pada periode {selected_date}.
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
                sku_qty: skuQty,
                kunjungan,
              });
            }}
          >
            <div className="space-y-2">
              <FieldLabel
                htmlFor={`${field_id}-sku-qty`}
                label="Jumlah SKU"
                required
              />
              <Input
                id={`${field_id}-sku-qty`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={skuQty}
                onChange={(event) => setSkuQty(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                htmlFor={`${field_id}-kunjungan`}
                label="Kunjungan"
                required
              />
              <Input
                id={`${field_id}-kunjungan`}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={kunjungan}
                onChange={(event) => setKunjungan(event.target.value)}
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
              <Button
                type="submit"
                disabled={is_saving}
                aria-busy={is_saving}
              >
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
