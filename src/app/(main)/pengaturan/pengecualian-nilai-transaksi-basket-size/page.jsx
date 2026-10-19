"use client";

import { useEffect, useState } from "react";
import { MoveRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import PageHeading from "@/components/page-heading";
import OptionDropdown from "@/components/option-dropdown";
import FilterField from "@/components/filter-field";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import Pagination from "@/components/pagination";
import usePagination from "@/hooks/usePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import PengaturanRowSheet from "../component/pengaturan-row-sheet";
import { findExclusionConflict, parseExclusionRange } from "@/lib/ntBsSummaryExclusion";

const PAGE_SIZE = 50;

async function requestExclusions(options) {
  const response = await fetch("/api/pengecualian", { cache: "no-store", ...options });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Gagal memuat pengecualian.");
  return result;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatRange(item) {
  return `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`;
}

export default function PengecualianPage() {
  const [data, setData] = useState({ outlets: [], exclusions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [outlet, setOutlet] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let ignore = false;
    requestExclusions()
      .then((result) => { if (!ignore) setData(result.data); })
      .catch((error) => { if (!ignore) toast.error(error.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  async function mutate(method, body) {
    setBusy(true);
    try {
      const result = await requestExclusions({
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      toast.success(result.message);
      setCreating(false);
      setEditing(null);
      setDeleting(null);
      const latest = await requestExclusions();
      setData(latest.data);
    } catch (error) {
      if (method !== "DELETE") throw error;
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const outletOptions = new Map(data.outlets.map((item) => [item.uuid, { value: item.uuid, label: item.name }]));
  for (const item of data.exclusions) {
    if (!outletOptions.has(item.uuid_outlet)) outletOptions.set(item.uuid_outlet, { value: item.uuid_outlet, label: item.outlet.name });
  }
  const options = [...outletOptions.values()].sort((a, b) => a.label.localeCompare(b.label, "id-ID"));
  const invalidRange = fromDate && toDate && fromDate > toDate;
  const filtered = data.exclusions.filter((item) =>
    !invalidRange && (outlet === "all" || item.uuid_outlet === outlet)
    && (!fromDate || item.end_date >= fromDate)
    && (!toDate || item.start_date <= toDate));
  const pagination = usePagination(filtered, PAGE_SIZE);
  const fields = [
    {
      key: "uuid_outlet", label: "Outlet", type: "select", options,
      required: true, searchable: true, search_placeholder: "Cari outlet...",
      empty_search_message: "Outlet tidak ditemukan.", disabled: busy,
    },
    { key: "start_date", label: "Tanggal Mulai", type: "date", required: true, disabled: busy },
    {
      key: "end_date", label: "Tanggal Selesai", type: "date", required: true, disabled: busy,
      helper: "Berlaku untuk total Nilai Transaksi dan Basket Size berdasarkan tanggal laporan yang dipilih. Setelah rentang berakhir, outlet kembali dihitung termasuk angka bulan pembanding. Rentang outlet yang sama tidak boleh bertabrakan.",
    },
  ];

  async function saveExclusion(item) {
    parseExclusionRange(item.start_date, item.end_date);
    if (!item.uuid_outlet) throw new Error("Outlet wajib dipilih.");
    const conflict = findExclusionConflict(data.exclusions.filter((row) => row.uuid !== item.uuid), {
      outlet_uuids: [item.uuid_outlet], start_date: item.start_date, end_date: item.end_date,
    });
    if (conflict) throw new Error(`Rentang bertabrakan dengan pengecualian pada ${formatRange(conflict)}.`);
    await mutate(item.uuid ? "PATCH" : "POST", {
      ...(item.uuid ? { uuid: item.uuid } : {}),
      outlet_uuids: [item.uuid_outlet], start_date: item.start_date, end_date: item.end_date,
    });
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <PageHeading title="Pengecualian Nilai Transaksi dan Basket Size" description="Kelola pengecualian total berdasarkan outlet dan rentang tanggal. Data detail tetap ditampilkan." />
      <Card className="gap-0 border-t-2 border-t-primary/70">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Daftar Pengecualian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
            <FilterField label="Outlet" htmlFor="filter-outlet-pengecualian" className="w-full lg:w-[320px]">
              <OptionDropdown id="filter-outlet-pengecualian" value={outlet} onValueChange={(value) => { setOutlet(value); pagination.setCurrentPage(1); }} options={[{ value: "all", label: "Semua Outlet" }, ...options]} searchable searchPlaceholder="Cari outlet..." emptyMessage="Outlet tidak ditemukan." ariaLabel="Filter outlet" disabled={loading} />
            </FilterField>
            <FilterField label="Rentang Tanggal" className="w-full max-w-[352px] sm:col-span-2 lg:w-[352px]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <Input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); pagination.setCurrentPage(1); }} aria-label="Filter tanggal mulai pengecualian" aria-invalid={!!invalidRange} disabled={loading} className="w-full" />
                <div className="flex items-center justify-center text-muted-foreground">
                  <MoveRightIcon className="size-4" />
                  <span className="sr-only">sampai</span>
                </div>
                <Input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); pagination.setCurrentPage(1); }} aria-label="Filter tanggal selesai pengecualian" aria-invalid={!!invalidRange} disabled={loading} className="w-full" />
              </div>
              {invalidRange && <p role="alert" className="text-sm text-destructive">Tanggal selesai tidak boleh lebih awal dari tanggal mulai.</p>}
            </FilterField>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Button type="button" className="w-full shrink-0 sm:w-auto" onClick={() => setCreating(true)} disabled={loading || busy}><PlusIcon className="size-4" />Tambah Pengecualian</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-card">
          <div className="max-h-[560px] overflow-auto">
          <Table containerClassName="overflow-visible" className="min-w-[760px]">
            <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
              <TableRow>
                <TableHead className="w-14 text-center">No.</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Rentang Tanggal</TableHead>
                <TableHead className="w-[180px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginated_rows.map((item, index) => (
                <TableRow key={item.uuid}>
                  <TableCell className="w-14 text-center">{(pagination.current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                  <TableCell className="whitespace-normal font-medium">{item.outlet.name}</TableCell>
                  <TableCell className="font-medium">{formatRange(item)}</TableCell>
                  <TableCell className="whitespace-nowrap"><div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(item)}><PencilIcon className="size-4" />Edit</Button>
                    <Button variant="delete" size="sm" disabled={busy} onClick={() => setDeleting(item)}><Trash2Icon className="size-4" />Hapus</Button>
                  </div></TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{loading ? "Memuat…" : "Belum ada pengecualian yang sesuai filter."}</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
          {!!filtered.length && <Pagination current_page={pagination.current_page} page_size={PAGE_SIZE} total_items={filtered.length} total_pages={pagination.total_pages} item_label="pengecualian" on_previous={pagination.previous_page} on_next={pagination.next_page} />}
          </div>
        </CardContent>
      </Card>
      {(creating || editing) && (
        <PengaturanRowSheet
          key={editing?.uuid ?? "create"}
          open
          on_open_change={(open) => { if (!busy && !open) { setCreating(false); setEditing(null); } }}
          title={editing ? "Edit Pengecualian" : "Tambah Pengecualian"}
          item={editing ?? { uuid_outlet: "", start_date: "", end_date: "" }}
          fields={fields}
          on_save={saveExclusion}
        />
      )}
      <ConfirmActionDialog open={!!deleting} onOpenChange={(open) => { if (!busy && !open) setDeleting(null); }} title="Hapus Pengecualian" description={`Hapus pengecualian ${deleting?.outlet.name ?? ""}${deleting ? ` pada ${formatRange(deleting)}` : ""}? Data outlet akan kembali disertakan dalam total pada rentang tersebut.`} confirmLabel="Hapus Pengecualian" confirmVariant="delete" isPending={busy} onConfirm={() => mutate("DELETE", { uuid: deleting?.uuid })} />
    </div>
  );
}
