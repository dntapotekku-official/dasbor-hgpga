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
  const [daily, setDaily] = useState(String(row?.nt_daily ?? 0));

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
                Edit Nilai Transaksi Harian
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Ubah nilai harian {row?.outlet_name ?? "outlet"} pada {selected_date}.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={is_saving}
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
              on_submit({ daily });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`${field_id}-nilai-harian`}>Harian</Label>
              <Input
                id={`${field_id}-nilai-harian`}
                type="number"
                min="0"
                step="1"
                value={daily}
                onChange={(event) => setDaily(event.target.value)}
                disabled={is_saving}
                required
              />
              <p className="text-xs text-muted-foreground">
                Kolom selain Harian tidak berubah.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close
                render={
                  <Button type="button" variant="outline" disabled={is_saving} />
                }
              >
                Batal
              </DialogPrimitive.Close>
              <Button type="submit" disabled={is_saving || daily === ""}>
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
