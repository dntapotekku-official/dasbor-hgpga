"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleOffIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import SortableTableHead from "@/components/sortable-table-head";
import SyncActionButton from "@/components/sync-action-button";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "./pengaturan-row-sheet";
import {
  outlet_category_filter_options,
  outlet_category_options,
} from "@/lib/outletCategories";
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

const PAGE_SIZE = 50;

function get_excel_cell_value(cell_value) {
  if (cell_value && typeof cell_value === "object") {
    if ("result" in cell_value) {
      return get_excel_cell_value(cell_value.result);
    }

    if (Array.isArray(cell_value.richText)) {
      return cell_value.richText.map((item) => item.text ?? "").join("");
    }

    if ("text" in cell_value) {
      return cell_value.text;
    }
  }

  return cell_value ?? "";
}

export default function OutletManagementCard() {
  const [sync_status, setSyncStatus] = useState("pending");
  const [outlet, setOutlet] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(outlet, ["name", "username"]);
  const [selected_category, setSelectedCategory] = useState("all");
  const [selected_status, setSelectedStatus] = useState("all");
  const [selected_outlet, setSelectedOutlet] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [updating_exception_uuid, setUpdatingExceptionUuid] = useState(null);
  const [is_importing_credentials, setIsImportingCredentials] = useState(false);
  const import_credentials_input_ref = useRef(null);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const scoped_items = useMemo(
    () =>
      filtered_items.filter((item) => {
        const matches_category =
          selected_category === "all" || item.kategori === selected_category;
        const matches_status =
          selected_status === "all" ||
          (selected_status === "excluded" ? item.excep : !item.excep);

        return matches_category && matches_status;
      }),
    [filtered_items, selected_category, selected_status],
  );
  const sorted_items = useMemo(() => {
    return [...scoped_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      if (sort_key === "excep") {
        return (Number(Boolean(a.excep)) - Number(Boolean(b.excep))) * direction;
      }

      return String(a[sort_key] ?? "").localeCompare(
        String(b[sort_key] ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [scoped_items, sort_direction, sort_key]);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_items, PAGE_SIZE);

  const fetch_outlet = async () => {
    const outlet_result = await fetch("/api/outlet?include_excluded=true");
    const outlet_data = await outlet_result.json();

    if (!outlet_result.ok || !outlet_data.success) {
      throw new Error(outlet_data.message || "Gagal mengambil data outlet.");
    }

    return outlet_data.data.data_outlet;
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_outlet() {
      try {
        const data = await fetch_outlet();

        if (should_ignore) {
          return;
        }

        setOutlet(data);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data outlet.",
          );
        }
      }
    }

    void load_outlet();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selected_category, selected_status, setCurrentPage]);

  const sync_outlet_handler = async () => {
    try {
      setSyncStatus("syncing");

      const result = await fetch("/api/outlet", { method: "POST" });
      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Sinkronisasi outlet gagal dijalankan.");
      }

      const latest_data = await fetch_outlet();
      setOutlet(latest_data);
      toast.success("Sinkronisasi data outlet berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi outlet.",
      );
    } finally {
      setSyncStatus("pending");
    }
  };

  const import_credentials = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsImportingCredentials(true);

      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("File yang didukung hanya format .xlsx.");
      }

      const exceljs_module = await import("exceljs");
      const ExcelJS = exceljs_module.default ?? exceljs_module;
      const workbook = new ExcelJS.Workbook();

      await workbook.xlsx.load(await file.arrayBuffer());

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error("File Excel tidak memiliki worksheet.");
      }

      const header_indexes = new Map();

      worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column_index) => {
        const header = String(get_excel_cell_value(cell.value)).trim().toLowerCase();

        if (header) {
          header_indexes.set(header, column_index);
        }
      });

      const outlet_column = header_indexes.get("outlet");
      const username_column = header_indexes.get("username");
      const password_column = header_indexes.get("password");

      if (!outlet_column || !username_column || !password_column) {
        throw new Error(
          "File wajib memiliki kolom Outlet, Username, dan Password.",
        );
      }

      const rows = [];

      worksheet.eachRow({ includeEmpty: false }, (row, row_number) => {
        if (row_number === 1) {
          return;
        }

        const outlet_name = String(
          get_excel_cell_value(row.getCell(outlet_column).value),
        ).trim();

        if (!outlet_name) {
          return;
        }

        rows.push({
          outlet_name,
          username: String(
            get_excel_cell_value(row.getCell(username_column).value),
          ).trim(),
          password: String(
            get_excel_cell_value(row.getCell(password_column).value),
          ),
        });
      });

      const response = await fetch("/api/outlet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_credentials", rows }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Impor akun outlet gagal.");
      }

      setOutlet(await fetch_outlet());
      toast.success(payload.message || "Akun outlet berhasil diimpor.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Impor akun outlet gagal.",
      );
    } finally {
      setIsImportingCredentials(false);
      event.target.value = "";
    }
  };

  const handle_save = async (next_outlet) => {
    const response = await fetch("/api/outlet", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: "outlet",
        uuid_outlet: next_outlet.uuid,
        name: next_outlet.name,
        kategori: next_outlet.kategori,
        is_skip_sync: next_outlet.is_skip_sync,
        username: next_outlet.username,
        password: next_outlet.password,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data outlet.");
    }

    setOutlet((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Data outlet berhasil diperbarui.");
  };

  const handle_exception = async (selected_item) => {
    try {
      setUpdatingExceptionUuid(selected_item.uuid);
      const response = await fetch("/api/outlet", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_exception",
          uuid_outlet: selected_item.uuid,
          excep: !selected_item.excep,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.message || "Gagal memperbarui pengecualian outlet.",
        );
      }

      setOutlet((current) =>
        current.map((item) =>
          item.uuid === payload.data.uuid ? payload.data : item,
        ),
      );
      toast.success(payload.message || "Pengecualian outlet diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui pengecualian outlet.",
      );
    } finally {
      setUpdatingExceptionUuid(null);
    }
  };

  const format_kategori_label = (kategori) =>
    outlet_category_options.find((option) => option.value === kategori)?.label ?? "-";

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

  return (
    <Card className="gap-0 border-t-2 border-t-primary/70">
      <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Outlet</CardTitle>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            onClick={() => import_credentials_input_ref.current?.click()}
            disabled={is_importing_credentials}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
          >
            {is_importing_credentials ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheetIcon className="size-4" />
            )}
            Impor Akun
          </Button>
          <Input
            ref={import_credentials_input_ref}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={import_credentials}
            className="sr-only"
            tabIndex={-1}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <FilterField
              label="Pencarian"
              htmlFor="filter-pencarian-outlet"
              className="w-full sm:max-w-sm"
            >
              <Input
                id="filter-pencarian-outlet"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari outlet..."
              />
            </FilterField>
            <FilterField label="Kategori" htmlFor="filter-kategori-outlet">
              <OptionDropdown
                id="filter-kategori-outlet"
                value={selected_category}
                onValueChange={setSelectedCategory}
                options={outlet_category_filter_options}
                ariaLabel="Filter kategori outlet"
                triggerClassName="w-full lg:w-52"
              />
            </FilterField>
            <FilterField label="Status" htmlFor="filter-status-outlet">
              <OptionDropdown
                id="filter-status-outlet"
                value={selected_status}
                onValueChange={setSelectedStatus}
                options={[
                  { value: "all", label: "Semua status" },
                  { value: "active", label: "Aktif" },
                  { value: "excluded", label: "Dikecualikan" },
                ]}
                ariaLabel="Filter status outlet"
                triggerClassName="w-full lg:w-48"
              />
            </FilterField>
            <SyncActionButton
              onConfirm={sync_outlet_handler}
              description="Sinkronisasi akan memperbarui daftar outlet dari sumber utama dan menimpa data terbaru yang tersedia."
              isPending={sync_status === "syncing"}
              className="w-full lg:ml-auto lg:w-auto"
            />
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="max-h-[560px] overflow-auto">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Nama Outlet"
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
                        label="Kategori"
                        sortKey="kategori"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Status"
                        sortKey="excep"
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
                      <TableCell>{(current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{format_kategori_label(row.kategori)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            row.excep
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {row.excep ? "Dikecualikan" : "Aktif"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOutlet(row);
                              setIsSheetOpen(true);
                            }}
                          >
                            <PencilIcon className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant={row.excep ? "outline" : "delete"}
                            size="sm"
                            onClick={() => handle_exception(row)}
                          >
                            {row.excep ? (
                              <RotateCcwIcon className="size-4" />
                            ) : (
                              <CircleOffIcon className="size-4" />
                            )}
                            {updating_exception_uuid === row.uuid
                              ? "Menyimpan..."
                              : row.excep
                                ? "Aktifkan"
                                : "Kecualikan"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {scoped_items.length === 0 ? (
              <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada outlet yang cocok dengan pencarian.
              </div>
            ) : (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={scoped_items.length}
                total_pages={total_pages}
                item_label="outlet"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>

          <PengaturanRowSheet
            key={selected_outlet?.uuid ?? "outlet-sheet"}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title="Edit Outlet"
            description="Perbarui data outlet pada tampilan pengaturan."
            item={selected_outlet}
            fields={[
              {
                key: "name",
                label: "Nama Outlet",
                placeholder: "Masukkan nama outlet",
                required: true,
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username login outlet",
                required: true,
              },
              {
                key: "password",
                label: "Password Baru",
                type: "password",
                placeholder: "Kosongkan jika tidak diubah",
                helper: "Minimal 6 karakter. Kosongkan untuk mempertahankan password saat ini.",
              },
              {
                key: "kategori",
                label: "Kategori",
                type: "select",
                placeholder: "Pilih kategori outlet",
                options: outlet_category_options,
              },
              {
                key: "is_skip_sync",
                label: "Lewati saat sinkron",
                type: "checkbox",
              },
            ]}
            on_save={handle_save}
          />
        </div>
      </CardContent>
    </Card>
  );
}
