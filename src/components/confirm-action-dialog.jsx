"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  confirmVariant = "default",
  onConfirm,
  isPending = false,
}) {
  const handle_open_change = (next_open) => {
    if (isPending && !next_open) {
      return;
    }

    onOpenChange(next_open);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handle_open_change}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="font-heading text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                />
              }
            >
              <XIcon className="size-4" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="outline" disabled={isPending} />
              }
            >
              {cancelLabel}
            </DialogPrimitive.Close>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
