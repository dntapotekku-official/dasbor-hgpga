"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRangeIcon,
  FileSpreadsheetIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import CurrencyValue from "@/components/currency-value";
import OptionDropdown from "@/components/option-dropdown";
import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import usePagination from "@/hooks/usePagination";
import PengaturanRowSheet from "../../component/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TargetImportModal from "./target-import-modal";
import TargetBulkDateModal from "./target-bulk-date-modal";
import TargetBulkDeleteModal from "./target-bulk-delete-modal";

const PAGE_SIZE = 50;

async function fetch_target_management_data(endpoint, target_label) {
  const [target_result, outlet_result] = await Promise.all([
    fetch(endpoint),
    fetch("/api/outlet"),
  ]);
  const [target_payload, outlet_payload] = await Promise.all([
    target_result.json(),
    outlet_result.json(),
  ]);

  if (!target_result.ok || !target_payload.success) {
    throw new Error(target_payload.message || `Gagal mengambil data ${target_label}.`);
  }

  if (!outlet_result.ok || !outlet_payload.success) {
    throw new Error(outlet_payload.message || "Gagal mengambil data outlet.");
  }

  const items = target_payload.data?.items ?? target_payload.data?.data_target_gofitku ?? [];
  const rows = items.map((item) => ({
    ...item,
    range_label: format_target_range(item.start_date, item.end_date),
  }));
  const options = (outlet_payload.data?.data_outlet ?? []).map((item) => ({
    value: item.uuid,
    label: item.name,
  }));

  return {
    rows,
    options,
  };
}

function format_target_date(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function format_target_range(start_date, end_date) {
  const start_label = format_target_date(start_date);
  const end_label = format_target_date(end_date);

  return start_date === end_date
    ? start_label
    : `${start_label} - ${end_label}`;
}

function format_integer_target(value) {
  return Number(value ?? 0).toLocaleString("id-ID");
}

export default function TargetManagementCard({
  card_title,
  endpoint,
  empty_message,
  target_label,
  create_title,
  create_description,
  edit_title,
  edit_description,
  delete_title,
  delete_description_template,
  target_placeholder,
  target_helper,
  target_value_format = "integer",
  delete_payload_key = "uuid_target_metric",
  import_date_mode = "range",
}) {
  const [target_rows, setTargetRows] = useState([]);
  const [outlet_options, setOutletOptions] = useState([]);
  const [selected_outlet, setSelectedOutlet] = useState("all");
  const [selected_date, setSelectedDate] = useState("");
  const [selected_target, setSelectedTarget] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [is_import_modal_open, setIsImportModalOpen] = useState(false);
  const [is_importing, setIsImporting] = useState(false);
  const [is_bulk_date_modal_open, setIsBulkDateModalOpen] = useState(false);
  const [is_bulk_date_updating, setIsBulkDateUpdating] = useState(false);
  const [is_bulk_delete_modal_open, setIsBulkDeleteModalOpen] = useState(false);
  const [is_bulk_deleting, setIsBulkDeleting] = useState(false);
  const [target_to_delete, setTargetToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [sort_key, setSortKey] = useState("outlet_name");
  const [sort_direction, setSortDirection] = useState("asc");
  const outlet_filter_options = useMemo(
    () => [{ value: "all", label: "Semua outlet" }, ...outlet_options],
    [outlet_options],
  );
  const filtered_items = useMemo(
    () =>
      target_rows.filter(
        (row) =>
          (selected_outlet === "all" ||
            row.uuid_outlet === selected_outlet) &&
          (!selected_date ||
            (row.start_date <= selected_date &&
              (!row.end_date || row.end_date >= selected_date))),
      ),
    [selected_date, selected_outlet, target_rows],
  );
  const sorted_items = useMemo(() => {
    return [...filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      if (sort_key === "target") {
        return ((Number(a.target) || 0) - (Number(b.target) || 0)) * direction;
      }

      if (sort_key === "start_date") {
        return String(a.start_date ?? "").localeCompare(
          String(b.start_date ?? ""),
        ) * direction;
      }

      return String(a.outlet_name ?? "").localeCompare(
        String(b.outlet_name ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [filtered_items, sort_direction, sort_key]);
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
    setSortDirection(next_sort_key === "outlet_name" ? "asc" : "desc");
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_rows() {
      try {
        const { rows, options } = await fetch_target_management_data(endpoint, target_label);

        if (should_ignore) {
          return;
        }

        setTargetRows(rows);
        setOutletOptions(options);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : `Gagal mengambil data ${target_label}.`,
          );
        }
      }
    }

    void load_rows();

    return () => {
      should_ignore = true;
    };
  }, [endpoint, target_label]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selected_date, selected_outlet, setCurrentPage]);

  const handle_create = async (new_target) => {
    const result = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_outlet: new_target.uuid_outlet,
        start_date: new_target.start_date,
        end_date: new_target.end_date,
        target: new_target.target,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      toast.error(payload.message || `Gagal menambahkan ${target_label}.`);
      return;
    }

    setTargetRows((current) => [
      {
        ...payload.data,
        range_label: format_target_range(
          payload.data.start_date,
          payload.data.end_date,
        ),
      },
      ...current,
    ]);
    toast.success(payload.message || `${target_label} berhasil ditambahkan.`);
  };

  const handle_save = async (next_target) => {
    const update_payload = {
      uuid_outlet: next_target.uuid_outlet,
      start_date: next_target.start_date,
      end_date: next_target.end_date,
      target: next_target.target,
    };

    if (delete_payload_key === "uuid_target_gofitku") {
      update_payload.uuid_target_gofitku = next_target.uuid;
    } else {
      update_payload.uuid_target_metric = next_target.uuid;
    }

    const result = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update_payload),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      toast.error(payload.message || `Gagal memperbarui ${target_label}.`);
      return;
    }

    setTargetRows((current) =>
      current.map((item) =>
        item.uuid === payload.data.uuid
          ? {
              ...payload.data,
              range_label: format_target_range(
                payload.data.start_date,
                payload.data.end_date,
              ),
            }
          : item,
      ),
    );
    toast.success(payload.message || `${target_label} berhasil diperbarui.`);
  };

  const handle_delete = async () => {
    if (!target_to_delete) {
      return;
    }

    setIsDeletePending(true);

    try {
      const result = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [delete_payload_key]: target_to_delete.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || `Gagal menghapus ${target_label}.`);
      }

      setTargetRows((current) => current.filter((item) => item.uuid !== target_to_delete.uuid));
      setTargetToDelete(null);
      toast.success(payload.message || `${target_label} berhasil dihapus.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal menghapus ${target_label}.`,
      );
    } finally {
      setIsDeletePending(false);
    }
  };

  const handle_import = async ({
    import_date,
    start_date,
    end_date,
    file,
  }) => {
    try {
      setIsImporting(true);

      const form_data = new FormData();
      form_data.append("file", file);

      if (import_date_mode === "range") {
        form_data.append("start_date", start_date);
        form_data.append("end_date", end_date);
      } else {
        form_data.append("import_date", import_date);
      }

      const result = await fetch(endpoint, {
        method: "POST",
        body: form_data,
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || `Gagal mengimpor ${target_label}.`);
      }

      const { rows, options } = await fetch_target_management_data(endpoint, target_label);
      setTargetRows(rows);
      setOutletOptions(options);
      setIsImportModalOpen(false);
      toast.success(payload.message || `${target_label} berhasil diimpor.`);

      if (Array.isArray(payload.data?.unmatched_outlets) && payload.data.unmatched_outlets.length) {
        toast.warning(
          `${payload.data.unmatched_outlets.length} outlet tidak cocok dengan master outlet.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Gagal mengimpor ${target_label}.`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handle_bulk_date_update = async ({
    source_start_date,
    source_end_date,
    start_date,
    end_date,
  }) => {
    try {
      setIsBulkDateUpdating(true);

      const result = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "bulk_update_dates",
          source_start_date,
          source_end_date,
          start_date,
          end_date,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(
          payload.message || `Gagal memperbarui tanggal ${target_label}.`,
        );
      }

      const { rows, options } = await fetch_target_management_data(
        endpoint,
        target_label,
      );
      setTargetRows(rows);
      setOutletOptions(options);
      setIsBulkDateModalOpen(false);
      toast.success(payload.message || `Tanggal ${target_label} berhasil diperbarui.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal memperbarui tanggal ${target_label}.`,
      );
    } finally {
      setIsBulkDateUpdating(false);
    }
  };

  const handle_bulk_delete = async ({
    source_start_date,
    source_end_date,
  }) => {
    try {
      setIsBulkDeleting(true);

      const result = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "bulk_delete_period",
          source_start_date,
          source_end_date,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(
          payload.message || `Gagal menghapus massal ${target_label}.`,
        );
      }

      const { rows, options } = await fetch_target_management_data(
        endpoint,
        target_label,
      );
      setTargetRows(rows);
      setOutletOptions(options);
      setIsBulkDeleteModalOpen(false);
      toast.success(payload.message || `${target_label} berhasil dihapus massal.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal menghapus massal ${target_label}.`,
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const fields = [
    {
      key: "uuid_outlet",
      label: "Outlet",
      type: "select",
      options: outlet_options,
      placeholder: "Pilih outlet",
      aria_label: `Pilih outlet ${target_label}`,
      searchable: true,
      search_placeholder: "Cari outlet...",
      empty_search_message: "Outlet tidak ditemukan.",
    },
    {
      key: "start_date",
      label: "Tanggal Mulai",
      type: "date",
    },
    {
      key: "end_date",
      label: "Tanggal Selesai",
      type: "date",
    },
    {
      key: "target",
      label: "Target",
      type: "number",
      placeholder: target_placeholder,
      input_type: "number",
      helper: target_helper,
    },
  ];

  const format_target_value = (value) => {
    if (target_value_format === "currency") {
      return <CurrencyValue value={value} align="left" />;
    }

    if (target_value_format === "decimal") {
      return Number(value ?? 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return format_integer_target(value);
  };

  const delete_description = delete_description_template.replace(
    "{range}",
    target_to_delete?.range_label ?? "-",
  );

  return (
    <Card className="gap-0 border-t-2 border-t-primary/70">
      <CardHeader className="border-b">
        <div className="flex w-full items-center gap-4">
          <CardTitle className="min-w-0 flex-1">{card_title}</CardTitle>
          <Button
            type="button"
            className="ml-auto shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setIsImportModalOpen(true)}
          >
            <FileSpreadsheetIcon className="size-4" />
            Impor
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <OptionDropdown
              value={selected_outlet}
              onValueChange={setSelectedOutlet}
              options={outlet_filter_options}
              searchable
              ariaLabel={`Filter outlet ${target_label}`}
              searchPlaceholder="Cari outlet..."
              emptySearchMessage="Outlet tidak ditemukan."
              triggerClassName="w-full sm:w-64"
            />
            <Input
              type="date"
              value={selected_date}
              onChange={(event) => setSelectedDate(event.target.value)}
              aria-label={`Filter tanggal berlaku ${target_label}`}
              className="w-full sm:w-44"
            />
            <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setIsBulkDateModalOpen(true)}
              >
                <CalendarRangeIcon className="size-4" />
                Edit Massal
              </Button>
              <Button
                type="button"
                variant="delete"
                className="flex-1 sm:flex-none"
                onClick={() => setIsBulkDeleteModalOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Hapus Massal
              </Button>
              <Button
                type="button"
                onClick={() => setIsCreateSheetOpen(true)}
                className="flex-1 sm:flex-none"
              >
                <PlusIcon className="size-4" />
                Tambah Target
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Outlet"
                        sortKey="outlet_name"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Range Tanggal"
                        sortKey="start_date"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Target"
                        sortKey="target"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead className="w-[180px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated_rows.map((row, index) => (
                    <TableRow key={row.uuid}>
                      <TableCell>
                        {(current_page - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{row.outlet_name}</TableCell>
                      <TableCell className="font-medium">{row.range_label}</TableCell>
                      <TableCell>{format_target_value(row.target)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTarget(row);
                              setIsSheetOpen(true);
                            }}
                          >
                            <PencilIcon className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="delete"
                            size="sm"
                            onClick={() => setTargetToDelete(row)}
                          >
                            <Trash2Icon className="size-4" />
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filtered_items.length === 0 ? (
              <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                {empty_message}
              </div>
            ) : (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={filtered_items.length}
                total_pages={total_pages}
                item_label="target"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>

          <PengaturanRowSheet
            key={selected_target?.uuid ?? `${card_title}-sheet`}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title={edit_title}
            description={edit_description}
            item={selected_target}
            fields={fields}
            on_save={handle_save}
          />

          <PengaturanRowSheet
            key={`${card_title}-create-sheet`}
            open={is_create_sheet_open}
            on_open_change={setIsCreateSheetOpen}
            title={create_title}
            description={create_description}
            item={{
              uuid_outlet: outlet_options[0]?.value ?? "",
              start_date: "",
              end_date: "",
              target: "",
            }}
            fields={fields}
            on_save={handle_create}
          />

          <ConfirmActionDialog
            open={Boolean(target_to_delete)}
            onOpenChange={(open) => {
              if (!open) {
                setTargetToDelete(null);
              }
            }}
            title={delete_title}
            description={delete_description}
            confirmLabel="Ya, hapus"
            confirmVariant="delete"
            isPending={is_delete_pending}
            onConfirm={handle_delete}
          />

          <TargetImportModal
            open={is_import_modal_open}
            date_mode={import_date_mode}
            is_importing={is_importing}
            target_label={target_label}
            on_open_change={setIsImportModalOpen}
            on_submit={handle_import}
          />

          {is_bulk_date_modal_open ? (
            <TargetBulkDateModal
              open
              date_mode="range"
              is_updating={is_bulk_date_updating}
              target_label={target_label}
              rows={target_rows}
              on_open_change={setIsBulkDateModalOpen}
              on_submit={handle_bulk_date_update}
            />
          ) : null}

          {is_bulk_delete_modal_open ? (
            <TargetBulkDeleteModal
              open
              is_deleting={is_bulk_deleting}
              target_label={target_label}
              rows={target_rows}
              on_open_change={setIsBulkDeleteModalOpen}
              on_submit={handle_bulk_delete}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
