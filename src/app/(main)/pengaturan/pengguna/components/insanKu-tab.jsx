"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  FilterIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import SortableTableHead from "@/components/sortable-table-head";
import SyncActionButton from "@/components/sync-action-button";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "../../component/pengaturan-row-sheet";
import JabatanGofitkuExclusionModal from "./jabatan-gofitku-exclusion-modal";
import BulkGofitkuExclusionModal from "./bulk-gofitku-exclusion-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SearchInput from "@/components/search-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;
const EMPTY_ADVANCED_FILTERS = {
  skip_identity: false,
  skip_placement: false,
  exclude_gofitku: false,
};

function has_selected_outlet_placement(outlet_placements) {
  return (
    Array.isArray(outlet_placements) &&
    outlet_placements.some((placement) =>
      String(placement?.outlet_uuid ?? "").trim(),
    )
  );
}

function build_insanku_sheet_key(item) {
  if (!item?.uuid) {
    return "insanku-sheet";
  }

  const placement_key = (item.outlet_placements ?? [])
    .map((placement) => [
      placement.uuid ?? "",
      placement.outlet_uuid ?? "",
      placement.uuid_jabatan_master ?? "",
      Boolean(placement.jabatan_is_active),
    ].join(":"))
    .join("|");

  return [
    item.uuid,
    placement_key,
    Boolean(item.is_skip_sync_insanku),
    Boolean(item.is_skip_sync_outlet_insanku),
    Boolean(item.is_exclude_penjualan_gofitku),
  ].join(":");
}

export default function InsanKuTab({ is_non_slip_gaji = false }) {
  const [sync_status, setSyncStatus] = useState("idle");
  const [outlet, setOutlet] = useState([]);
  const [jabatan, setJabatan] = useState([]);
  const [insanku, setInsanKu] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(insanku, ["name"]);
  const [selected_outlet, setSelectedOutlet] = useState("all");
  const [selected_insanku, setSelectedInsanKu] = useState(null);
  const [account_action_insanku, setAccountActionInsanKu] = useState(null);
  const [is_processing_account_action, setIsProcessingAccountAction] =
    useState(false);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_creating, setIsCreating] = useState(false);
  const [is_jabatan_exclusion_open, setIsJabatanExclusionOpen] = useState(false);
  const [is_bulk_open, setIsBulkOpen] = useState(false);
  const [is_bulk_saving, setIsBulkSaving] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const [is_filter_modal_open, setIsFilterModalOpen] = useState(false);
  const [advanced_filters, setAdvancedFilters] = useState(
    EMPTY_ADVANCED_FILTERS,
  );
  const [draft_advanced_filters, setDraftAdvancedFilters] = useState(
    EMPTY_ADVANCED_FILTERS,
  );
  const outlet_options = useMemo(
    () => [
      { value: "all", label: "Semua outlet" },
      ...outlet.map((item) => ({ value: item.uuid, label: item.name })),
    ],
    [outlet],
  );
  const advanced_filtered_items = useMemo(
    () => filtered_items.filter((item) => {
      if (advanced_filters.skip_identity && !item.is_skip_sync_insanku) {
        return false;
      }

      if (
        advanced_filters.skip_placement &&
        !item.is_skip_sync_outlet_insanku
      ) {
        return false;
      }

      if (!advanced_filters.exclude_gofitku) {
        return true;
      }

      if (!item.is_exclude_penjualan_gofitku) {
        return false;
      }

      return true;
    }),
    [advanced_filters, filtered_items],
  );
  const outlet_filtered_items = useMemo(
    () =>
      selected_outlet === "all"
        ? advanced_filtered_items
        : advanced_filtered_items.filter((item) =>
            item.outlet_uuids?.includes(selected_outlet),
          ),
    [advanced_filtered_items, selected_outlet],
  );
  const active_advanced_filter_count = [
    advanced_filters.skip_identity,
    advanced_filters.skip_placement,
    advanced_filters.exclude_gofitku,
  ].filter(Boolean).length;
  const sorted_items = useMemo(() => {
    return [...outlet_filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;
      const first_value = sort_key === "outlet_names"
        ? (a.outlet_names ?? []).join(", ")

        : a[sort_key];
      const second_value = sort_key === "outlet_names"
        ? (b.outlet_names ?? []).join(", ")

        : b[sort_key];

      return String(first_value ?? "").localeCompare(
        String(second_value ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [outlet_filtered_items, sort_direction, sort_key]);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_items, PAGE_SIZE);

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection("asc");
  };

  const pending_gofitku_rows = useMemo(() => insanku
    .filter((item) => item.is_active && item.is_gofitku_setup_pending)
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID")), [insanku]);

  const handle_bulk_gofitku_save = async (settings) => {
    setIsBulkSaving(true);
    try {
      const response = await fetch("/api/insanku", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_gofitku_exclusion", ...settings }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal menyimpan pengaturan GoFitKu.");
      const selected = new Set(settings.uuid_insanku);
      setInsanKu((current) => current.map((item) => selected.has(item.uuid) ? {
        ...item, is_gofitku_setup_pending: false,
        is_exclude_penjualan_gofitku: settings.is_exclude_penjualan_gofitku,
      } : item));
      setIsBulkOpen(false);
      toast.success(payload.message);
    } finally { setIsBulkSaving(false); }
  };

  const fetch_insanku = useCallback(async () => {
    const api_endpoint = is_non_slip_gaji
      ? "/api/insanku-non-slip-gaji"
      : "/api/insanku";
    const [outlet_result, insanku_result] = await Promise.all([
      fetch("/api/outlet"),
      fetch(api_endpoint),
    ]);
    const [outlet_data, insanku_data] = await Promise.all([
      outlet_result.json(),
      insanku_result.json(),
    ]);

    if (!outlet_result.ok || !outlet_data.success) {
      throw new Error(outlet_data.message || "Gagal mengambil data outlet.");
    }

    if (!insanku_result.ok || !insanku_data.success) {
      throw new Error(
        insanku_data.message || "Gagal mengambil data InsanKU.",
      );
    }

    return {
      outlet: outlet_data.data.data_outlet,
      insanku: insanku_data.data.data_insanku,
      jabatan: insanku_data.data.data_jabatan ?? [],
    };
  }, [is_non_slip_gaji]);

  useEffect(() => {
    let should_ignore = false;

    async function load_insanku() {
      try {
        const data = await fetch_insanku();

        if (should_ignore) {
          return;
        }

        setOutlet(data.outlet);
        setJabatan(data.jabatan);
        setInsanKu(data.insanku);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data InsanKU.",
          );
        }
      }
    }

    void load_insanku();

    return () => {
      should_ignore = true;
    };
  }, [fetch_insanku]);

  useEffect(() => {
    setCurrentPage(1);
  }, [advanced_filters, search, selected_outlet, setCurrentPage]);

  const handle_filter_modal_open_change = (next_open) => {
    setIsFilterModalOpen(next_open);

    if (next_open) {
      setDraftAdvancedFilters({ ...advanced_filters });
    }
  };

  const apply_advanced_filters = () => {
    setAdvancedFilters({ ...draft_advanced_filters });
    setIsFilterModalOpen(false);
  };

  const reset_advanced_filters = () => {
    setAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS });
    setDraftAdvancedFilters({ ...EMPTY_ADVANCED_FILTERS });
    setIsFilterModalOpen(false);
  };

  const sync_insanku_handler = async () => {
    try {
      setSyncStatus("syncing");

      const insanku_result = await fetch("/api/insanku", { method: "POST" });
      const insanku_payload = await insanku_result.json();

      if (!insanku_result.ok || !insanku_payload.success) {
        throw new Error(
          insanku_payload.message || "Sinkronisasi data InsanKU gagal dijalankan.",
        );
      }

      const outlet_insanku_result = await fetch("/api/outlet-insanku", {
        method: "POST",
      });
      const outlet_insanku_payload = await outlet_insanku_result.json();

      if (!outlet_insanku_result.ok || !outlet_insanku_payload.success) {
        throw new Error(
          outlet_insanku_payload.message ||
            "Sinkronisasi penempatan InsanKU gagal dijalankan.",
        );
      }

      const latest_data = await fetch_insanku();
      setOutlet(latest_data.outlet);
      setJabatan(latest_data.jabatan);
      setInsanKu(latest_data.insanku);
      toast.success("Sinkronisasi data InsanKU berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi InsanKU.",
      );
    } finally {
      setSyncStatus("idle");
    }
  };

  const handle_save = async (next_insanku) => {
    const api_endpoint = is_non_slip_gaji
      ? "/api/insanku-non-slip-gaji"
      : "/api/insanku";
    const is_new = is_non_slip_gaji && !next_insanku.uuid;
    const outlet_placements = next_insanku.outlet_placements ?? [];
    const outlet_uuids = outlet_placements
      .map((placement) => String(placement?.outlet_uuid ?? "").trim())
      .filter(Boolean);
    const response = await fetch(api_endpoint, {
      method: is_new ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_insanku: next_insanku.uuid,
        nik: next_insanku.nik,
        name: next_insanku.name,
        username: next_insanku.username,
        is_active: next_insanku.is_active,
        outlet_placements,
        outlet_uuids,
        deleted_outlet_placements: next_insanku.deleted_outlet_placements ?? [],
        is_skip_sync_insanku: next_insanku.is_skip_sync_insanku,
        is_skip_sync_outlet_insanku: next_insanku.is_skip_sync_outlet_insanku,
        is_exclude_penjualan_gofitku: next_insanku.is_exclude_penjualan_gofitku,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(
        payload.message ||
          (is_new
            ? "Gagal menambahkan data InsanKU."
            : "Gagal memperbarui data InsanKU."),
      );
    }

    setInsanKu((current) =>
      is_new
        ? [payload.data, ...current]
        : current.map((item) =>
            item.uuid === payload.data.uuid ? payload.data : item,
          ),
    );
    setSelectedInsanKu(is_new ? null : payload.data);
    setIsCreating(false);
    toast.success(
      payload.message ||
        (is_new
          ? "Data InsanKU Non Slip Gaji berhasil ditambahkan."
          : "Data InsanKU berhasil diperbarui."),
    );
  };

  const handle_account_action = async () => {
    if (!account_action_insanku) {
      return;
    }

    const api_endpoint = is_non_slip_gaji
      ? "/api/insanku-non-slip-gaji"
      : "/api/insanku";
    const account_label = is_non_slip_gaji
      ? "InsanKU Non Slip Gaji"
      : "InsanKU Slip Gaji";
    const action_label = is_non_slip_gaji ? "menghapus" : "mereset";
    try {
      setIsProcessingAccountAction(true);

      const response = await fetch(api_endpoint, {
        method: is_non_slip_gaji ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid_insanku: account_action_insanku.uuid,
          ...(!is_non_slip_gaji ? { action: "reset" } : {}),
        }),
      });
      const payload = await response.json();

      if (
        !response.ok ||
        !payload.success ||
        (!is_non_slip_gaji && !payload.data)
      ) {
        throw new Error(
          payload.message || `Gagal ${action_label} data ${account_label}.`,
        );
      }

      setInsanKu((current) => is_non_slip_gaji
        ? current.filter((row) => row.uuid !== account_action_insanku.uuid)
        : current.map((row) =>
            row.uuid === payload.data.uuid ? payload.data : row,
          ));
      setSelectedInsanKu((current) =>
        current?.uuid === account_action_insanku.uuid
          ? (is_non_slip_gaji ? null : payload.data)
          : current,
      );
      setAccountActionInsanKu(null);
      toast.success(
        payload.message || `Data ${account_label} berhasil direset.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal ${action_label} data ${account_label}.`,
      );
    } finally {
      setIsProcessingAccountAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {!is_non_slip_gaji ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-5">
            Sebelum menekan <strong>Sinkron InsanKU</strong>, {" "}
            <strong>sinkronkan Outlet terlebih dahulu</strong> melalui menu Outlet.
          </p>
        </div>
      ) : null}

      <Card className="gap-0 border-t-2 border-t-primary/70">
        <CardHeader className="border-b">
          <CardTitle>
            {is_non_slip_gaji
              ? "InsanKU (Non Slip Gaji)"
              : "InsanKU (Slip Gaji)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-start">
              <FilterField
                label="Pencarian"
                htmlFor="filter-pencarian-insanku"
                className="w-full lg:min-w-48 lg:max-w-sm lg:flex-1"
              >
                <SearchInput
                  id="filter-pencarian-insanku"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama InsanKU..."
                  onClear={() => setSearch("")}
                />
              </FilterField>
              {!is_non_slip_gaji ? (
                <FilterField label="Outlet" htmlFor="filter-outlet-insanku" className="w-full lg:w-64 lg:shrink-0">
                  <OptionDropdown
                    id="filter-outlet-insanku"
                    value={selected_outlet}
                    onValueChange={setSelectedOutlet}
                    options={outlet_options}
                    searchable
                    ariaLabel="Filter outlet InsanKU"
                    searchPlaceholder="Cari outlet..."
                    emptySearchMessage="Outlet tidak ditemukan."
                    triggerClassName="w-full"
                  />
                </FilterField>
              ) : null}
              {!is_non_slip_gaji ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handle_filter_modal_open_change(true)}
                  className="w-full shrink-0 lg:w-auto"
                >
                  <FilterIcon className="size-4" />
                  <span>Filter Lanjutan</span>
                  {active_advanced_filter_count > 0 ? (
                    <span>({active_advanced_filter_count})</span>
                  ) : null}
                </Button>
              ) : null}
              {is_non_slip_gaji ? (
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedInsanKu(null);
                    setIsCreating(true);
                    setIsSheetOpen(true);
                  }}
                  className="w-full shrink-0 lg:ml-auto lg:w-auto"
                >
                  <PlusIcon className="size-4" />
                  Tambah InsanKU Non Slip Gaji
                </Button>
              ) : (
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:ml-auto lg:w-auto">
                <Button type="button" className="w-full shrink-0 sm:w-auto" disabled={sync_status === "syncing" || is_bulk_saving} onClick={() => setIsJabatanExclusionOpen(true)}>
                  <ListChecksIcon className="size-4" />Pengecualian Jabatan
                </Button>
                <Button type="button" className="w-full shrink-0 sm:w-auto" disabled={sync_status === "syncing" || is_bulk_saving} onClick={() => setIsBulkOpen(true)}>
                  <ListChecksIcon className="size-4" />Atur Banyak{pending_gofitku_rows.length > 0 ? ` (${pending_gofitku_rows.length})` : ""}
                </Button>
                <SyncActionButton
                  onConfirm={sync_insanku_handler}
                  title="Konfirmasi sinkronisasi InsanKU"
                  description="Sinkronisasi akan memperbarui data InsanKU beserta penempatan outlet terbaru dari sumber utama."
                  confirmLabel="Ya, sinkronkan InsanKU"
                  idleLabel="Sinkron"
                  isPending={sync_status === "syncing"}
                  className="w-full shrink-0 sm:w-auto"
                />
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[560px] overflow-auto">
                <Table className="min-w-max" containerClassName="overflow-visible">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-14 min-w-14">No.</TableHead>
                      <TableHead className="w-44 min-w-44">
                        <SortableTableHead
                          label="NIK"
                          sortKey="nik"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead className="min-w-64">
                        <SortableTableHead
                          label="Nama"
                          sortKey="name"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableTableHead
                          label="Username"
                          sortKey="username"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableTableHead
                          label="Outlet"
                          sortKey="outlet_names"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead>
                        <SortableTableHead
                          label="Tanggal Bergabung"
                          sortKey="join_date"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated_rows.map((row, index) => (
                      <TableRow key={row.uuid}>
                        <TableCell className="w-14 min-w-14">
                          {(current_page - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell className="w-44 min-w-44">
                          {row.nik || "-"}
                        </TableCell>
                        <TableCell className="min-w-64 font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.username}</TableCell>
                        <TableCell>
                          {Array.isArray(row.outlet_placements) &&
                          row.outlet_placements.length > 0 ? (
                            <ul className="list-disc space-y-1 pl-4">
                              {row.outlet_placements.map((placement) => (
                                <li
                                  key={`${row.uuid}-${placement.uuid || placement.outlet_uuid}`}
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium">
                                      {placement.outlet_name || "-"}
                                    </span>
                                    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                      {placement.jabatan_name ||
                                        placement.uuid_jabatan_master ||
                                        "-"}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.join_date
                            ? new Date(row.join_date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                timeZone: "UTC",
                              })
                            : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInsanKu(row);
                              setIsCreating(false);
                              setIsSheetOpen(true);
                            }}
                          >
                            <PencilIcon className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant={is_non_slip_gaji ? "delete" : "outline"}
                            size="sm"
                            onClick={() => setAccountActionInsanKu(row)}
                          >
                            {is_non_slip_gaji ? (
                              <Trash2Icon className="size-4" />
                            ) : (
                              <RotateCcwIcon className="size-4" />
                            )}
                            {is_non_slip_gaji ? "Hapus" : "Reset"}
                          </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {outlet_filtered_items.length === 0 ? (
                <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada InsanKU yang cocok dengan pencarian.
                </div>
              ) : (
                <Pagination
                  current_page={current_page}
                  page_size={PAGE_SIZE}
                  total_items={outlet_filtered_items.length}
                  total_pages={total_pages}
                  item_label="InsanKU"
                  on_previous={previous_page}
                  on_next={next_page}
                />
              )}
            </div>

            <PengaturanRowSheet
              key={build_insanku_sheet_key(selected_insanku)}
              open={is_sheet_open}
              on_open_change={setIsSheetOpen}
              title={
                is_creating
                  ? "Tambah InsanKU Non Slip Gaji"
                  : `Edit InsanKU (${is_non_slip_gaji ? "Non Slip Gaji" : "Slip Gaji"})`
              }
              description={
                is_creating
                  ? "Tambahkan akun InsanKU Non Slip Gaji secara manual."
                  : "Perbarui data InsanKU pada tampilan pengaturan."
              }
              item={selected_insanku}
	              fields={[
              ...(is_non_slip_gaji
                ? [
                    {
                      key: "nik",
                      label: "NIK",
                      placeholder: "Masukkan NIK",
                      required: true,
                    },
                  ]
                : []),
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama InsanKU",
              },
              {
                key: "join_date",
                label: "Tanggal Bergabung",
                type: "date",
                disabled: true,
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              ...(!is_non_slip_gaji
                ? [
                    {
                      key: "is_skip_sync_insanku",
                      label: "Lewati nama dan username saat sinkronisasi",
                      type: "checkbox",
                    },
                  ]
                : []),
              {
                key: "outlet_placements",
                deleted_key: "deleted_outlet_placements",
                label: "Outlet",
                type: "placement-list",
                options: outlet.map((item) => ({
                  value: item.uuid,
                  label: item.name,
                })),
                jabatan_options: jabatan.map((item) => ({
                  value: item.uuid,
                  label: item.name,
                })),
                on_change: (draft) =>
                  has_selected_outlet_placement(draft.outlet_placements)
                    ? {}
                    : {
                        is_skip_sync_outlet_insanku: false,
                      },
                on_period_click: () => setHistoryInsanKu(selected_insanku),
              },
              ...(!is_non_slip_gaji
                ? [
                    {
                      key: "is_skip_sync_outlet_insanku",
                      label: "Lewati penempatan saat sinkronisasi",
                      type: "checkbox",
                      disabled: (draft) =>
                        !has_selected_outlet_placement(draft.outlet_placements),
                      helper: (draft) =>
                        !has_selected_outlet_placement(draft.outlet_placements)
                          ? "Checkbox ini aktif setelah InsanKU memiliki minimal satu outlet."
                          : "Checkbox ini berlaku untuk semua penempatan outlet milik InsanKU ini.",
                    },
                    {
                      key: "is_exclude_penjualan_gofitku",
                      label: "Kecualikan dalam penjualan GoFitKu",
                      type: "checkbox",
                      helper: "Pengecualian berlaku selamanya selama tetap diaktifkan.",
                    },
                  ]
                : []),
              ]}
              on_save={handle_save}
            />
            {!is_non_slip_gaji && is_jabatan_exclusion_open && (
              <JabatanGofitkuExclusionModal on_open_change={setIsJabatanExclusionOpen} />
            )}
            {!is_non_slip_gaji && is_bulk_open && (
              <BulkGofitkuExclusionModal rows={pending_gofitku_rows} is_saving={is_bulk_saving} on_open_change={setIsBulkOpen} on_save={handle_bulk_gofitku_save} />
            )}
            {!is_non_slip_gaji ? (
              <DialogPrimitive.Root
                open={is_filter_modal_open}
                onOpenChange={handle_filter_modal_open_change}
              >
                <DialogPrimitive.Portal>
                  <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
                  <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
                    <div className="flex items-start justify-between gap-4 border-b p-5">
                      <div>
                        <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                          Filter Lanjutan
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                          Saring data berdasarkan pengaturan sinkronisasi dan pengecualian.
                        </DialogPrimitive.Description>
                      </div>
                      <DialogPrimitive.Close
                        render={
                          <Button type="button" variant="ghost" size="icon-sm" />
                        }
                      >
                        <XIcon className="size-4" />
                        <span className="sr-only">Tutup</span>
                      </DialogPrimitive.Close>
                    </div>

                    <div className="grid gap-4 overflow-y-auto p-5">
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={draft_advanced_filters.skip_identity}
                          onChange={(event) =>
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              skip_identity: event.target.checked,
                            }))
                          }
                          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/50"
                        />
                        <span>Nama dan username yang dilewati</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={draft_advanced_filters.skip_placement}
                          onChange={(event) =>
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              skip_placement: event.target.checked,
                            }))
                          }
                          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/50"
                        />
                        <span>Penempatan yang dilewati</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={draft_advanced_filters.exclude_gofitku}
                          onChange={(event) =>
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              exclude_gofitku: event.target.checked,
                            }))
                          }
                          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/50"
                        />
                        <span>Dikecualikan pada penjualan GoFitKu</span>
                      </label>


                    </div>

                    <div className="flex justify-end gap-2 border-t p-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={reset_advanced_filters}
                      >
                        Reset
                      </Button>
                      <Button type="button" onClick={apply_advanced_filters}>
                        Terapkan
                      </Button>
                    </div>
                  </DialogPrimitive.Popup>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
            ) : null}
            <ConfirmActionDialog
              open={Boolean(account_action_insanku)}
              onOpenChange={(next_open) => {
                if (!next_open && !is_processing_account_action) {
                  setAccountActionInsanKu(null);
                }
              }}
              title={is_non_slip_gaji
                ? "Hapus InsanKU Non Slip Gaji"
                : "Reset InsanKU Slip Gaji"}
              description={is_non_slip_gaji
                ? `Data ${account_action_insanku?.name ?? ""} akan dihapus beserta relasi aktifnya. Lanjutkan?`
                : `Nama dan username ${account_action_insanku?.name ?? ""} akan dikembalikan dari data Slip Gaji. Lanjutkan?`}
              confirmLabel={is_non_slip_gaji ? "Ya, hapus" : "Ya, reset"}
              confirmVariant={is_non_slip_gaji ? "delete" : "default"}
              onConfirm={handle_account_action}
              isPending={is_processing_account_action}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
