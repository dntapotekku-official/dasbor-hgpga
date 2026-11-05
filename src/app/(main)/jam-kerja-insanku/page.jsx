"use client";


import { useEffect, useState } from "react";
import { ArrowLeftIcon, EyeIcon, FileSpreadsheetIcon, InfoIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import { useAuth } from "@/components/auth-provider";
import { hasRoleAccess } from "@/lib/role";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import SearchInput from "@/components/search-input";
import SyncActionButton from "@/components/sync-action-button";
import PengaturanRowSheet from "@/app/(main)/pengaturan/component/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";

import PageHeading from "@/components/page-heading";
import KegiatanDetail from "./components/kegiatan-detail";
import Pagination from "@/components/pagination";
import usePagination from "@/hooks/usePagination";
import SortableTableHead from "@/components/sortable-table-head";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;
const month_options = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
  .map((label, index) => ({ value: String(index + 1), label }));

/** Mengambil bulan dan tahun saat ini berdasarkan zona waktu WITA. */
function current_period() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar", month: "numeric", year: "numeric",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { month: String(Number(parts.month)), year: parts.year };
}

const edit_fields = [
  { key: "pharmaapp", label: "Jam Kerja (PharmApp)", type: "number", min: 0, step: "any", required: true },
  { key: "excel", label: "Jam Kerja (Mandiri)", type: "number", min: 0, step: "any", required: true },
];

/** Mengirim permintaan rekap jam kerja beserta periode dan menangani respons API. */
async function request_data(method = "GET", body, signal, period) {
  const query = method === "GET" && period ? `?${new URLSearchParams(period)}` : "";
  const response = await fetch(`/api/jam-kerja-insanku${query}`, {
    method,
    cache: "no-store",
    signal,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message ?? "Gagal memproses jam kerja InsanKU.");
  return result;
}

/** Menampilkan rekap bulanan, filter, aksi pengaturan, dan detail kegiatan InsanKU. */
export default function JamKerjaInsanKuPage() {
  const { role } = useAuth();
  const is_admin = hasRoleAccess(role, ["admin"]);
  const [period, setPeriod] = useState(current_period);
  const period_label = `${month_options.find((item) => item.value === period.month)?.label} ${period.year}`;
  const year_options = Array.from({ length: Number(current_period().year) - 2000 + 2 }, (_, index) => {
    const year = String(Number(current_period().year) + 1 - index);
    return { value: year, label: year };
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [load_error, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [edit_row, setEditRow] = useState(null);
  const [detail_row, setDetailRow] = useState(null);
  const [delete_row, setDeleteRow] = useState(null);
  const [bulk_action, setBulkAction] = useState(null);
  const [filters, setFilters] = useState({ name: "", outlet: "all", verified: "all", validated: "all" });

  useEffect(() => {
    const controller = new AbortController();
    request_data("GET", undefined, controller.signal, period)
      .then((result) => { setRows(result.data); setLoadError(""); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, period]);

  /** Menyimpan nilai atau status beberapa baris rekap lalu memperbarui tampilan lokal. */
  async function save_rows(payload) {
    setPending(true);
    try {
      await request_data("PATCH", { ...payload, ...period });
      const ids = new Set(payload.ids ?? [payload.id]);
      setRows((current) => current.map((row) => ids.has(row.id) ? {
        ...row,
        ...(payload.pharmaapp !== undefined ? { pharmaapp: Number(payload.pharmaapp) } : {}),
        ...(payload.excel !== undefined ? { excel: Number(payload.excel) } : {}),
        ...(payload.verified !== undefined ? { verified: payload.verified } : {}),
        ...(payload.validated !== undefined ? { validated: payload.validated } : {}),
      } : row));
      toast.success("Jam kerja InsanKU berhasil disimpan.");
    } finally {
      setPending(false);
    }
  }

  /** Mengosongkan jam kerja pada periode terpilih melalui API dan memperbarui tabel. */
  async function delete_record() {
    setPending(true);
    try {
      await request_data("DELETE", { id: delete_row.id, ...period });
      setRows((current) => current.map((row) => row.id === delete_row.id ? { ...row, pharmaapp: 0, excel: 0 } : row));
      setDeleteRow(null);
      toast.success("Jam kerja berhasil dihapus.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  }
  const [sort, setSort] = useState({ key: null, direction: "asc" });
  const outlet_options = [
    { value: "all", label: "Semua outlet" },
    ...[...new Set(rows.map((row) => row.outlet))]
      .sort((first, second) => first.localeCompare(second, "id"))
      .map((outlet) => ({ value: outlet, label: outlet })),
  ];
  const filtered_rows = rows.filter((row) =>
    row.name.toLowerCase().includes(filters.name.trim().toLowerCase()) &&
    (filters.outlet === "all" || row.outlet === filters.outlet) &&
    (filters.verified === "all" || String(row.verified) === filters.verified) &&
    (filters.validated === "all" || String(row.validated) === filters.validated),
  );
  const sorted_rows = [...filtered_rows].sort((first, second) => {
    if (!sort.key) return 0;

    const first_value = first[sort.key];
    const second_value = second[sort.key];
    const comparison = typeof first_value === "string"
      ? first_value.localeCompare(second_value, "id", { sensitivity: "base" })
      : Number(first_value) - Number(second_value);

    return sort.direction === "asc" ? comparison : -comparison;
  });

  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_rows, PAGE_SIZE);

  /** Mengganti bulan atau tahun laporan dan menyiapkan pemuatan ulang data. */
  function update_period(field, value) {
    setPeriod((current) => ({ ...current, [field]: value }));
    setRows([]);
    setLoadError("");
    setLoading(true);
    setCurrentPage(1);
  }

  /** Memperbarui filter rekap dan mengembalikan pagination ke halaman pertama. */
  function update_filter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setCurrentPage(1);
  }

  /** Memuat ulang rekap penempatan dan menampilkan status sinkronisasi. */
  async function sync_rows() {
    setSyncing(true);
    try {
      const result = await request_data("GET", undefined, undefined, period);
      setRows(result.data);
      setLoadError("");
      setCurrentPage(1);
      toast.success("Data jam kerja berhasil dimuat ulang dari Outlet InsanKU.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  }

  /** Mengganti kolom dan arah pengurutan tabel jam kerja. */
  function handle_sort(key) {
    setCurrentPage(1);
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  /** Menampilkan tombol pengurutan pada header kolom. */
  function render_sort(field, label, right_aligned = false) {
    return (
      <SortableTableHead
        label={label}
        sortKey={field}
        currentSortKey={sort.key}
        sortDirection={sort.direction}
        onSort={handle_sort}
        buttonClassName={right_aligned ? "justify-end text-right" : ""}
      />
    );
  }

  /** Menentukan atribut aksesibilitas sesuai arah pengurutan kolom. */
  function sort_aria(field) {
    return sort.key === field ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  }

  /** Menyimpan perubahan verifikasi atau validasi pada satu baris rekap. */
  async function update_checkbox(id, field, checked) {
    try {
      await save_rows({ id, [field]: checked });
    } catch (error) {
      toast.error(error.message);
    }
  }

  /** Menampilkan checkbox untuk mengubah status seluruh baris sesuai filter. */
  function render_bulk_checkbox(field, label) {
    const checked_count = filtered_rows.filter((row) => row[field]).length;

    return (
      <label className="flex cursor-pointer items-center justify-center gap-2">
        <input
          type="checkbox"
          checked={filtered_rows.length > 0 && checked_count === filtered_rows.length}
          disabled={pending || syncing || loading || filtered_rows.length === 0}
          onChange={(event) => setBulkAction({
            ids: filtered_rows.map((row) => row.id),
            field,
            label,
            checked: event.target.checked,
          })}
          aria-label={`${label} seluruh InsanKU sesuai filter di semua halaman`}
          className="size-4 cursor-pointer accent-primary align-middle"
        />
        {label}
      </label>
    );
  }

  if (detail_row) {
    return (
      <div className="space-y-6 px-4 lg:px-6">
        <PageHeading
          title="Jam Kerja InsanKU"
          description="Rincian rekap jam kerja pada periode terpilih."
        />
        <Button type="button" variant="outline" onClick={() => setDetailRow(null)}>
          <ArrowLeftIcon className="size-4" />
          Kembali
        </Button>
        <Card className="border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-medium">Nama:</span> {detail_row.name}</p>
            <p><span className="font-medium">Periode:</span> {detail_row.period_label}</p>
            <KegiatanDetail key={`${detail_row.id}-${period.year}-${period.month}`} placement={detail_row} period={period} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <PageHeading
        title="Jam Kerja InsanKU"
        description="Rekapitulasi jam kerja InsanKU dengan perbandingan dari PharmApp dan pengisian mandiri."
      />
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          Validasi dan verifikasi diterapkan berdasarkan filter yang berlaku.
        </p>
      </div>
      <Card className="border-t-2 border-t-primary/70">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
          <CardTitle>Data Jam Kerja InsanKU</CardTitle>
          <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700">
            <FileSpreadsheetIcon className="size-4" />
            Impor
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <FilterField label="Nama" htmlFor="filter-nama-jam-kerja" className="w-full sm:w-60">
              <SearchInput
                id="filter-nama-jam-kerja"
                showSearchIcon
                value={filters.name}
                onChange={(event) => update_filter("name", event.target.value)}
                onClear={() => update_filter("name", "")}
                placeholder="Cari nama InsanKU..."
              />
            </FilterField>
            {is_admin && (
              <FilterField label="Outlet" htmlFor="filter-outlet-jam-kerja" className="w-full sm:w-64">
                <OptionDropdown
                  id="filter-outlet-jam-kerja"
                  value={filters.outlet}
                  options={outlet_options}
                  onValueChange={(value) => update_filter("outlet", value)}
                  ariaLabel="Filter outlet jam kerja"
                  searchable
                  searchPlaceholder="Cari outlet..."
                />
              </FilterField>
            )}
            <FilterField label="Bulan" htmlFor="filter-bulan-jam-kerja" className="w-36">
              <OptionDropdown
                id="filter-bulan-jam-kerja"
                value={period.month}
                options={month_options}
                onValueChange={(value) => update_period("month", value)}
                ariaLabel="Filter bulan jam kerja"
                disabled={pending || syncing || Boolean(edit_row) || Boolean(delete_row) || Boolean(bulk_action)}
              />
            </FilterField>
            <FilterField label="Tahun" htmlFor="filter-tahun-jam-kerja" className="w-28">
              <OptionDropdown
                id="filter-tahun-jam-kerja"
                value={period.year}
                options={year_options}
                onValueChange={(value) => update_period("year", value)}
                ariaLabel="Filter tahun jam kerja"
                disabled={pending || syncing || Boolean(edit_row) || Boolean(delete_row) || Boolean(bulk_action)}
                searchable
                searchPlaceholder="Cari tahun..."
              />
            </FilterField>
            <FilterField label="Status Verifikasi" htmlFor="filter-verifikasi-jam-kerja" className="w-max">
              <OptionDropdown
                id="filter-verifikasi-jam-kerja"
                value={filters.verified}
                options={[{ value: "all", label: "Semua" }, { value: "true", label: "Sudah" }, { value: "false", label: "Belum" }]}
                onValueChange={(value) => update_filter("verified", value)}
                ariaLabel="Filter status verifikasi jam kerja"
              />
            </FilterField>
            <FilterField label="Status Validasi" htmlFor="filter-validasi-jam-kerja" className="w-max">
              <OptionDropdown
                id="filter-validasi-jam-kerja"
                value={filters.validated}
                options={[{ value: "all", label: "Semua" }, { value: "true", label: "Sudah" }, { value: "false", label: "Belum" }]}
                onValueChange={(value) => update_filter("validated", value)}
                ariaLabel="Filter status validasi jam kerja"
              />
            </FilterField>
            <SyncActionButton
              className="ml-auto"
              onConfirm={sync_rows}
              title="Sinkronisasi Jam Kerja InsanKU"
              description={`Muat ulang nama, outlet, dan rekap jam kerja ${period_label} dari data Outlet InsanKU.`}
              isPending={syncing}
              disabled={loading || pending}
            />
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table className="min-w-[1400px]" containerClassName="max-h-[70vh] overflow-auto">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-16 text-center">No</TableHead>
                  <TableHead scope="col" aria-sort={sort_aria("name")}>
                    {render_sort("name", "Nama")}
                  </TableHead>
                  <TableHead scope="col" aria-sort={sort_aria("outlet")}>
                    {render_sort("outlet", "Outlet")}
                  </TableHead>
                  <TableHead scope="col">Periode</TableHead>
                  <TableHead scope="col" aria-sort={sort_aria("pharmaapp")} className="text-right">
                    {render_sort("pharmaapp", "Jam Kerja (PharmApp)", true)}
                  </TableHead>
                  <TableHead scope="col" aria-sort={sort_aria("excel")} className="text-right">
                    {render_sort("excel", "Jam Kerja (Mandiri)", true)}
                  </TableHead>
                  <TableHead scope="col" className="bg-orange-200! text-center text-black!">
                    {render_bulk_checkbox("verified", "Verifikasi")}
                  </TableHead>
                  <TableHead scope="col" className="bg-orange-200! text-center text-black!">
                    {render_bulk_checkbox("validated", "Validasi")}
                  </TableHead>
                  <TableHead scope="col" className="text-left">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered_rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      {loading ? "Memuat data jam kerja..." : load_error || (rows.length ? "Tidak ada data yang sesuai dengan filter." : "Belum ada data Outlet InsanKU untuk ditampilkan.")}
                      {load_error && !loading && (
                        <Button className="ml-3" variant="outline" onClick={() => { setLoading(true); setReload((current) => current + 1); }}>Coba lagi</Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {paginated_rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-center">{(current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.outlet}</TableCell>
                    <TableCell>{period_label}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.pharmaapp} jam</TableCell>
                    <TableCell className="text-right tabular-nums">{row.excel} jam</TableCell>
                    <TableCell className="bg-orange-50 text-center dark:bg-orange-100">
                      <input
                        type="checkbox"
                        disabled={pending || syncing}
                        checked={row.verified}
                        onChange={(event) => update_checkbox(row.id, "verified", event.target.checked)}
                        aria-label={`Verifikasi ${row.name}`}
                        className="size-4 cursor-pointer accent-primary align-middle"
                      />
                    </TableCell>
                    <TableCell className="bg-orange-50 text-center dark:bg-orange-100">
                      <input
                        type="checkbox"
                        disabled={pending || syncing}
                        checked={row.validated}
                        onChange={(event) => update_checkbox(row.id, "validated", event.target.checked)}
                        aria-label={`Validasi ${row.name}`}
                        className="size-4 cursor-pointer accent-primary align-middle"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-start gap-2">
                        <Button variant="outline" size="sm" disabled={pending || syncing} onClick={() => setDetailRow({ ...row, period_label })} aria-label={`Detail jam kerja ${row.name}`}>
                          <EyeIcon className="size-4" /> Detail
                        </Button>
                        <Button variant="outline" size="sm" disabled={pending || syncing} onClick={() => setEditRow(row)} aria-label={`Edit jam kerja ${row.name}`}>
                          <PencilIcon className="size-4" /> Edit
                        </Button>
                        <Button variant="delete" size="sm" disabled={pending || syncing} onClick={() => setDeleteRow(row)} aria-label={`Hapus nilai jam kerja ${row.name}`}>
                          <Trash2Icon className="size-4" /> Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered_rows.length > 0 && (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={filtered_rows.length}
                total_pages={total_pages}
                item_label="rekap jam kerja"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>
        </CardContent>
      </Card>
      {edit_row && (
        <PengaturanRowSheet
          key={edit_row.id}
          open
          on_open_change={(open) => { if (!open) setEditRow(null); }}
          title="Edit Jam Kerja InsanKU"
          description={`${edit_row.name} — ${edit_row.outlet} — ${period_label}`}
          item={edit_row}
          fields={edit_fields}
          on_save={(item) => save_rows({ id: item.id, pharmaapp: item.pharmaapp, excel: item.excel })}
        />
      )}
      <ConfirmActionDialog
        open={Boolean(bulk_action)}
        onOpenChange={(open) => { if (!open) setBulkAction(null); }}
        title={`Perubahan Status ${bulk_action?.label ?? ""}`}
        description={`Ubah semua menjadi ${bulk_action?.checked ? "sudah" : "belum"} ${bulk_action?.field === "verified" ? "diverifikasi" : "divalidasi"}? Perubahan diterapkan pada ${bulk_action?.ids.length ?? 0} data periode ${period_label} berdasarkan filter yang berlaku.`}
        confirmLabel="Ya, ubah status"
        isPending={pending}
        onConfirm={async () => {
          if (!bulk_action) return;
          try {
            await save_rows({ ids: bulk_action.ids, [bulk_action.field]: bulk_action.checked });
            setBulkAction(null);
          } catch (error) {
            toast.error(error.message);
          }
        }}
      />
      <ConfirmActionDialog
        open={Boolean(delete_row)}
        onOpenChange={(open) => { if (!open) setDeleteRow(null); }}
        title="Hapus Nilai Jam Kerja"
        description={`Hapus nilai jam kerja PharmApp dan Mandiri ${delete_row?.name ?? ""} di ${delete_row?.outlet ?? ""} untuk ${period_label}? Kedua nilai akan menjadi 0 dan baris tetap ditampilkan.`}
        confirmLabel="Hapus"
        confirmVariant="delete"
        onConfirm={delete_record}
        isPending={pending}
      />
    </div>
  );
}
