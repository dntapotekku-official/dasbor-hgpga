"use client";

import { useEffect, useId, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function JabatanGofitkuExclusionModal({ on_open_change }) {
  const id = useId();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/pengecualian-jabatan", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat master jabatan.");
        if (controller.signal.aborted) return;
        setRows(result.data);
        setSelected(result.data.filter((row) => row.is_excluded).map((row) => row.uuid));
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  const visible = rows.filter((row) => row.name.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID").trim()));
  const allSelected = visible.length > 0 && visible.every((row) => selected.includes(row.uuid));
  const disabled = loading || saving || !!error;

  async function submit(event) {
    event.preventDefault();
    if (disabled) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pengecualian-jabatan", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid_jabatan_master: selected }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal menyimpan pengecualian jabatan.");
      toast.success(result.message);
      on_open_change(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!saving) on_open_change(open); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b p-5">
            <DialogPrimitive.Title className="font-heading text-xl font-semibold">Pengecualian Jabatan</DialogPrimitive.Title>
            <DialogPrimitive.Close disabled={saving} render={<Button type="button" variant="ghost" size="icon-sm" />}>
              <XIcon className="size-4" /><span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
          </div>
          <form id={id} className="min-h-0 space-y-4 overflow-y-auto p-5" onSubmit={submit}>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Centang jabatan yang InsanKU-nya otomatis dikecualikan dari penjualan GoFitKu saat sinkronisasi. Pengecualian berlaku selamanya selama tetap diaktifkan.</DialogPrimitive.Description>
            <SearchInput value={search} onClear={() => setSearch("")} onChange={(event) => setSearch(event.target.value)} placeholder="Cari jabatan..." aria-label="Cari jabatan" disabled={disabled} />
            {error ? <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>Coba Lagi</Button></div> : null}
            <div className="max-h-80 overflow-auto rounded-lg border" aria-busy={loading}>
              <Table fixedColumns="none" containerClassName="overflow-visible">
                <TableHeader><TableRow>
                  <TableHead className="w-12 text-center"><input type="checkbox" aria-label="Pilih semua jabatan yang ditampilkan" checked={allSelected} disabled={disabled || !visible.length} onChange={(event) => {
                    const visibleIds = visible.map((row) => row.uuid);
                    setSelected((current) => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter((uuid) => !visibleIds.includes(uuid)));
                  }} className="size-4 accent-primary" /></TableHead>
                  <TableHead>Nama Jabatan</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {!loading && !error && visible.map((row) => <TableRow key={row.uuid}>
                    <TableCell className="text-center"><input id={`${id}-${row.uuid}`} type="checkbox" checked={selected.includes(row.uuid)} disabled={saving} onChange={() => setSelected((current) => current.includes(row.uuid) ? current.filter((uuid) => uuid !== row.uuid) : [...current, row.uuid])} className="size-4 accent-primary" /></TableCell>
                    <TableCell className="whitespace-normal font-medium"><label htmlFor={`${id}-${row.uuid}`} className="cursor-pointer">{row.name}</label></TableCell>
                  </TableRow>)}
                  {(loading || (!visible.length && !error)) && <TableRow><TableCell colSpan={2} className="py-8 text-center text-muted-foreground">{loading ? "Memuat master jabatan…" : rows.length ? "Jabatan tidak ditemukan." : "Belum ada master jabatan. Jalankan sinkronisasi InsanKU terlebih dahulu."}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">{selected.length} dari {rows.length} jabatan dipilih.</p>
          </form>
          <div className="flex shrink-0 justify-end gap-2 border-t p-5">
            <Button type="button" variant="outline" disabled={saving} onClick={() => on_open_change(false)}>Batal</Button>
            <Button type="submit" form={id} disabled={disabled}>{saving && <LoaderCircleIcon className="size-4 animate-spin" />}{saving ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
