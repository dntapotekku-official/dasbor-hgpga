"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ListPlusIcon,
  LoaderCircleIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import OptionDropdown from "@/components/option-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function create_empty_row() {
  return {
    key: 0,
    uuid_insanku: "",
    target: "",
  };
}

export default function TargetBulkCreateModal({
  open,
  is_submitting,
  entity_options,
  entity_label,
  on_open_change,
  on_submit,
}) {
  const [start_date, setStartDate] = useState("");
  const [end_date, setEndDate] = useState("");
  const [rows, setRows] = useState(() => [create_empty_row()]);

  const add_row = () => {
    setRows((current) => [
      ...current,
      {
        ...create_empty_row(),
        key: Math.max(...current.map((row) => row.key), -1) + 1,
      },
    ]);
  };

  const update_row = (key, values) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...values } : row)),
    );
  };

  const handle_submit = async (event) => {
    event.preventDefault();

    if (!start_date || !end_date) {
      toast.error("Tanggal mulai dan tanggal selesai wajib diisi.");
      return;
    }

    if (start_date > end_date) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }

    if (rows.some((row) => !row.uuid_insanku || row.target === "")) {
      toast.error(`Semua ${entity_label} dan nilai target wajib diisi.`);
      return;
    }

    const selected_entities = rows.map((row) => row.uuid_insanku);

    if (new Set(selected_entities).size !== selected_entities.length) {
      toast.error(`${entity_label} yang sama tidak boleh dipilih lebih dari sekali.`);
      return;
    }

    await on_submit({
      start_date,
      end_date,
      items: rows.map((row) => ({
        uuid_insanku: row.uuid_insanku,
        target: row.target,
      })),
    });
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
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b p-5">
            <div>
              <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                Tambah Massal Target GoFitKu
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Tambahkan beberapa target InsanKU untuk periode yang sama tanpa file Excel.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handle_submit}>
            <div className="space-y-5 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bulk-create-start-date">Tanggal Mulai</Label>
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
                  <Label htmlFor="bulk-create-end-date">Tanggal Selesai</Label>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Daftar Target</p>
                    <p className="text-xs text-muted-foreground">
                      Maksimal 100 InsanKU dalam satu kali penyimpanan.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={is_submitting || rows.length >= 100}
                    onClick={add_row}
                  >
                    <PlusIcon className="size-4" />
                    Tambah Baris
                  </Button>
                </div>

                {rows.map((row, index) => (
                  <div
                    key={row.key}
                    className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_12rem_2.25rem] sm:items-end"
                  >
                    <span className="pb-2 text-sm font-medium text-muted-foreground">
                      {index + 1}.
                    </span>
                    <div className="space-y-2">
                      <Label>{entity_label}</Label>
                      <OptionDropdown
                        value={row.uuid_insanku}
                        onValueChange={(value) =>
                          update_row(row.key, { uuid_insanku: value })
                        }
                        options={entity_options}
                        searchable
                        ariaLabel={`Pilih ${entity_label} baris ${index + 1}`}
                        searchPlaceholder={`Cari ${entity_label}...`}
                        emptySearchMessage={`${entity_label} tidak ditemukan.`}
                        triggerClassName="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`bulk-target-${row.key}`}>Target</Label>
                      <Input
                        id={`bulk-target-${row.key}`}
                        type="number"
                        min="0"
                        step="1"
                        value={row.target}
                        onChange={(event) =>
                          update_row(row.key, { target: event.target.value })
                        }
                        placeholder="Nilai target"
                        disabled={is_submitting}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={is_submitting || rows.length === 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.key !== row.key),
                        )
                      }
                    >
                      <Trash2Icon className="size-4" />
                      <span className="sr-only">Hapus baris {index + 1}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-5">
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
                {is_submitting ? "Menyimpan..." : `Simpan ${rows.length} Target`}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
