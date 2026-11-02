"use client";

import { useId, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import InsanKuOutletPlacements from "./insanku-outlet-placements";
import OptionDropdown from "@/components/option-dropdown";
import FilterField from "@/components/filter-field";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BulkGofitkuExclusionModal({ rows: pending_rows, excluded_rows, is_saving, on_open_change, on_save }) {
  const id = useId();
  const [mode, setMode] = useState("setup");
  const [keep_jabatan, setKeepJabatan] = useState(true);
  const rows = mode === "unset" ? excluded_rows : pending_rows;
  const [selected, setSelected] = useState(() => pending_rows.map((row) => row.uuid));
  const [enabled, setEnabled] = useState(false);
  const selectedIds = rows.filter((row) => selected.includes(row.uuid)).map((row) => row.uuid);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  async function submit(event) {
    event.preventDefault();
    if (is_saving) return;
    if (!selectedIds.length) { toast.error("Pilih minimal satu InsanKU."); return; }
    try {
      await on_save({
        action: mode === "unset" ? "bulk_unset_gofitku_exclusion" : "bulk_gofitku_exclusion",
        uuid_insanku: selectedIds, is_exclude_penjualan_gofitku: enabled,
        keep_jabatan_exclusion: keep_jabatan,
      });
    } catch (error) { toast.error(error.message); }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!is_saving) on_open_change(open); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b p-5">
          <DialogPrimitive.Title className="font-heading text-xl font-semibold">Atur Banyak InsanKU</DialogPrimitive.Title>
          <DialogPrimitive.Close disabled={is_saving} render={<Button type="button" variant="ghost" size="icon-sm" />}>
            <XIcon className="size-4" /><span className="sr-only">Tutup</span>
          </DialogPrimitive.Close>
        </div>
        <form id={id} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5" onSubmit={submit}>
          <FilterField label="Pengaturan">
            <OptionDropdown
              value={mode}
              options={[{ value: "setup", label: "Atur InsanKU Baru" }, { value: "unset", label: "Lepas Pengecualian" }]}
              ariaLabel="Pilih pengaturan banyak InsanKU"
              disabled={is_saving}
              onValueChange={(value) => {
                setMode(value);
                setSelected(value === "setup" ? pending_rows.map((row) => row.uuid) : []);
              }}
            />
          </FilterField>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{mode === "unset"
              ? "Pilih InsanKU yang ingin dilepas pengecualian penjualan GoFitKu-nya. Tidak dibatasi tanggal sinkronisasi."
              : "InsanKU baru dari sinkronisasi yang belum diatur dan dibuat dalam 7 hari terakhir. Semua nama terpilih secara default; hapus centang pada nama yang ingin diatur nanti sebelum batas waktu tersebut."}</p>
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table fixedColumns="none" containerClassName="overflow-visible">
                <TableHeader><TableRow>
                  <TableHead style={{ zIndex: 20 }} className="sticky left-0 w-12 min-w-12 max-w-12 bg-primary text-center"><input type="checkbox" aria-label="Pilih semua InsanKU" checked={allSelected} disabled={is_saving || !rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.uuid) : [])} className="size-4 accent-primary" /></TableHead>
                  <TableHead style={{ zIndex: 20 }} className="sticky left-12 min-w-44 bg-primary shadow-[1px_0_0_var(--border)]">Nama InsanKU</TableHead><TableHead>Outlet</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((row) => <TableRow key={row.uuid}>
                    <TableCell className="sticky left-0 z-10 w-12 min-w-12 max-w-12 bg-popover text-center"><input type="checkbox" aria-label={`Pilih ${row.name}`} checked={selected.includes(row.uuid)} disabled={is_saving} onChange={() => setSelected((current) => current.includes(row.uuid) ? current.filter((uuid) => uuid !== row.uuid) : [...current, row.uuid])} className="size-4 accent-primary" /></TableCell>
                    <TableCell className="sticky left-12 z-10 min-w-44 whitespace-nowrap bg-popover shadow-[1px_0_0_var(--border)]"><div className="font-medium">{row.name}</div>{row.nik && <div className="text-xs text-muted-foreground">{row.nik}</div>}</TableCell>
                    <TableCell className="whitespace-nowrap"><InsanKuOutletPlacements placements={row.outlet_placements} insanku_uuid={row.uuid} nowrap /></TableCell>
                  </TableRow>)}
                  {!rows.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{mode === "unset" ? "Belum ada InsanKU yang dikecualikan dari GoFitKu." : "Belum ada InsanKU baru yang menunggu pengaturan GoFitKu."}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">{selectedIds.length} dari {rows.length} InsanKU dipilih.</p>
          </div>
          <fieldset disabled={is_saving || !rows.length} className="space-y-5">
            {mode === "unset" ? <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={keep_jabatan} onChange={(event) => setKeepJabatan(event.target.checked)} className="size-4 accent-primary" />Tetap berlakukan pengecualian jabatan</label>
              <p className="text-xs text-muted-foreground">Jika dicentang, InsanKU dengan jabatan aktif yang dikecualikan tetap dikecualikan. Jika tidak, pengecualian seluruh nama terpilih akan dilepas. Aturan jabatan dapat diterapkan kembali saat sinkronisasi berikutnya.</p>
            </div> : <div className="space-y-2">
              <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-primary" />Kecualikan dalam penjualan GoFitKu</label>
              <p className="text-xs text-muted-foreground">Pengecualian berlaku selamanya selama tetap diaktifkan.</p>
            </div>}
          </fieldset>
        </form>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-5">
          <Button type="button" variant="outline" disabled={is_saving} onClick={() => on_open_change(false)}>Batal</Button>
          <Button type="submit" form={id} disabled={is_saving || !selectedIds.length}>{is_saving && <LoaderCircleIcon className="size-4 animate-spin" />}{is_saving ? "Menyimpan…" : `Simpan untuk ${selectedIds.length} InsanKU`}</Button>
        </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
