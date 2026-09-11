"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarRangeIcon,
  FileSpreadsheetIcon,
  ListPlusIcon,
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

const TargetImportModal = dynamic(() => import("./target-import-modal"));
const TargetBulkDateModal = dynamic(() => import("./target-bulk-date-modal"));
const TargetBulkDeleteModal = dynamic(
  () => import("./target-bulk-delete-modal"),
);
const TargetBulkCreateModal = dynamic(
  () => import("./target-bulk-create-modal"),
);

const PAGE_SIZE = 50;

async function fetch_target_management_data(endpoint, target_label) {
  const target_result = await fetch(endpoint);
  const target_payload = await target_result.json();

  if (!target_result.ok || !target_payload.success) {
    throw new Error(target_payload.message || `Gagal mengambil data ${target_label}.`);
  }

  const items = target_payload.data?.items ?? target_payload.data?.data_target_gofitku ?? [];
  const rows = items.map((item) => ({
    ...item,
    range_label: format_target_range(item.start_date, item.end_date),
  }));
  let options = target_payload.data?.options;

  if (!Array.isArray(options)) {
    const outlet_result = await fetch("/api/outlet");
    const outlet_payload = await outlet_result.json();

    if (!outlet_result.ok || !outlet_payload.success) {
      throw new Error(outlet_payload.message || "Gagal mengambil data outlet.");
    }

    options = (outlet_payload.data?.data_outlet ?? []).map((item) => ({
      value: item.uuid,
      label: item.name,
    }));
  }

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
  entity_key = "uuid_outlet",
  entity_name_key = "outlet_name",
  entity_label = "Outlet",
  import_button_label = "Impor",
  enable_bulk_create = false,
}) {
  const [target_rows, setTargetRows] = useState([]);
  const [entity_options, setEntityOptions] = useState([]);
  const [selected_entity, setSelectedEntity] = useState("all");
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
  const [is_bulk_create_modal_open, setIsBulkCreateModalOpen] = useState(false);
  const [is_bulk_creating, setIsBulkCreating] = useState(false);
  const [target_to_delete, setTargetToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [sort_key, setSortKey] = useState(entity_name_key);
  const [sort_direction, setSortDirection] = useState("asc");
  const entity_filter_options = useMemo(
    () => [{ value: "all", label: `Semua ${entity_label}` }, ...entity_options],
    [entity_label, entity_options],
  );
  const filtered_items = useMemo(
    () =>
      target_rows.filter(
        (row) =>
          (selected_entity === "all" ||
            row[entity_key] === selected_entity) &&
          (!selected_date ||
            (row.start_date <= selected_date &&
              (!row.end_date || row.end_date >= selected_date))),
      ),
    [entity_key, selected_date, selected_entity, target_rows],
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

      return String(a[entity_name_key] ?? "").localeCompare(
        String(b[entity_name_key] ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [entity_name_key, filtered_items, sort_direction, sort_key]);
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
    setSortDirection(next_sort_key === entity_name_key ? "asc" : "desc");
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
        setEntityOptions(options);
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
  }, [selected_date, selected_entity, setCurrentPage]);

  const handle_create = async (new_target) => {
    const result = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        [entity_key]: new_target[entity_key],
        start_date: new_target.start_date,
        end_date: new_target.end_date,
        target: new_target.target,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || `Gagal menambahkan ${target_label}.`);
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
      [entity_key]: next_target[entity_key],
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
      throw new Error(payload.message || `Gagal memperbarui ${target_label}.`);
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
      setEntityOptions(options);
      setIsImportModalOpen(false);
      toast.success(payload.message || `${target_label} berhasil diimpor.`);

      const unmatched_entities =
        payload.data?.unmatched_insanku ?? payload.data?.unmatched_outlets;

      if (Array.isArray(unmatched_entities) && unmatched_entities.length) {
        toast.warning(
          `${unmatched_entities.length} ${entity_label} tidak cocok dengan master data.`,
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
      setEntityOptions(options);
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
      setEntityOptions(options);
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

  const handle_bulk_create = async ({ start_date, end_date, items }) => {
    try {
      setIsBulkCreating(true);

      const result = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "bulk_create",
          start_date,
          end_date,
          items,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || `Gagal menambahkan massal ${target_label}.`);
      }

      const { rows, options } = await fetch_target_management_data(
        endpoint,
        target_label,
      );
      setTargetRows(rows);
      setEntityOptions(options);
      setIsBulkCreateModalOpen(false);
      toast.success(payload.message || `${target_label} berhasil ditambahkan massal.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal menambahkan massal ${target_label}.`,
      );
    } finally {
      setIsBulkCreating(false);
    }
  };

  const fields = [
    {
      key: entity_key,
      label: entity_label,
      type: "select",
      options: entity_options,
      placeholder: `Pilih ${entity_label}`,
      aria_label: `Pilih ${entity_label} ${target_label}`,
      searchable: true,
      search_placeholder: `Cari ${entity_label}...`,
      empty_search_message: `${entity_label} tidak ditemukan.`,
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
      type: target_value_format === "currency" ? "currency" : "number",
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
            {import_button_label}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <OptionDropdown
              value={selected_entity}
              onValueChange={setSelectedEntity}
              options={entity_filter_options}
              searchable
              ariaLabel={`Filter ${entity_label} ${target_label}`}
              searchPlaceholder={`Cari ${entity_label}...`}
              emptySearchMessage={`${entity_label} tidak ditemukan.`}
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
              {enable_bulk_create ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => setIsBulkCreateModalOpen(true)}
                >
                  <ListPlusIcon className="size-4" />
                  Tambah Massal
                </Button>
              ) : null}
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
                        label={entity_label}
                        sortKey={entity_name_key}
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
                      <TableCell className="font-medium">
                        {row[entity_name_key]}
                        {row.nik ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            NIK {row.nik}
                          </span>
                        ) : null}
                      </TableCell>
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
              [entity_key]: entity_options[0]?.value ?? "",
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

          {is_import_modal_open ? (
            <TargetImportModal
              open
              date_mode={import_date_mode}
              is_importing={is_importing}
              target_label={target_label}
              entity_label={entity_label}
              action_label={import_button_label}
              on_open_change={setIsImportModalOpen}
              on_submit={handle_import}
            />
          ) : null}

          {enable_bulk_create && is_bulk_create_modal_open ? (
            <TargetBulkCreateModal
              open
              is_submitting={is_bulk_creating}
              entity_options={entity_options}
              entity_label={entity_label}
              on_open_change={setIsBulkCreateModalOpen}
              on_submit={handle_bulk_create}
            />
          ) : null}

          {is_bulk_date_modal_open ? (
            <TargetBulkDateModal
              open
              date_mode="range"
              is_updating={is_bulk_date_updating}
              target_label={target_label}
              entity_label={entity_label}
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
              entity_label={entity_label}
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
