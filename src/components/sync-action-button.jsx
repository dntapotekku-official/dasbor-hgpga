"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";

export default function SyncActionButton({
  onConfirm,
  title = "Konfirmasi sinkronisasi",
  description,
  confirmLabel = "Ya, sinkronkan",
  idleLabel = "Sinkron",
  pendingLabel = "Menyinkronkan...",
  isPending = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [is_confirming, setIsConfirming] = useState(false);
  const is_pending = isPending || is_confirming;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {is_pending ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          idleLabel
        )}
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        isPending={is_pending}
        onConfirm={async () => {
          try {
            setIsConfirming(true);
            await onConfirm();
            setOpen(false);
          } finally {
            setIsConfirming(false);
          }
        }}
      />
    </>
  );
}
