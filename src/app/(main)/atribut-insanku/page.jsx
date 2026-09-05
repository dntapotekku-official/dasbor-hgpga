"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  FileSpreadsheetIcon,
  FilterIcon,
  InfoIcon,
  LoaderCircleIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import PageHeading from "@/components/page-heading";
import SortableTableHead from "@/components/sortable-table-head";
import SyncActionButton from "@/components/sync-action-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import usePagination from "@/hooks/usePagination";
import { get_socket } from "@/lib/socket-client";

const PAGE_SIZE = 50;

function compare_value(first_value, second_value) {
  const first_number = Number(first_value);
  const second_number = Number(second_value);

  if (Number.isFinite(first_number) && Number.isFinite(second_number)) {
    return first_number - second_number;
  }

  return String(first_value ?? "").localeCompare(
    String(second_value ?? ""),
    "id-ID",
    { numeric: true },
  );
}

function get_excel_cell_value(cell_value) {
  if (cell_value instanceof Date) {
    return cell_value.toISOString().slice(0, 10);
  }

  if (cell_value && typeof cell_value === "object") {
    if ("result" in cell_value) {
      return get_excel_cell_value(cell_value.result);
    }

    if (Array.isArray(cell_value.richText)) {
      return cell_value.richText.map((item) => item.text ?? "").join("");
    }

    if ("text" in cell_value) {
      return String(cell_value.text ?? "");
    }
  }

  return cell_value ?? "";
}

export default function AtributInsanKuPage() {
  const [attribute_columns, setAttributeColumns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [active_tab, setActiveTab] = useState("aktif");
  const [can_edit_values, setCanEditValues] = useState(false);
  const [is_member_view, setIsMemberView] = useState(false);
  const [search, setSearch] = useState("");
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const [is_loading_attributes, setIsLoadingAttributes] = useState(true);
  const [saving_cells, setSavingCells] = useState({});
  const [sync_status, setSyncStatus] = useState("idle");
  const [is_importing, setIsImporting] = useState(false);
  const [is_filter_modal_open, setIsFilterModalOpen] = useState(false);
  const [attribute_filters, setAttributeFilters] = useState({});
  const [draft_attribute_filters, setDraftAttributeFilters] = useState({});
  const import_input_ref = useRef(null);

  const fetch_attributes = useCallback(async () => {
    const response = await fetch("/api/atribut-insanku");
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data atribut.");
    }

    return payload.data ?? {};
  }, []);

  const load_attributes = useCallback(async () => {
    const data = await fetch_attributes();

    setAttributeColumns(data?.attribute_columns ?? []);
    setEmployees(data?.rows ?? []);
    setCanEditValues(Boolean(data?.can_edit_values));
    setIsMemberView(Boolean(data?.is_member_view));
  }, [fetch_attributes]);

  useEffect(() => {
    let is_active = true;

    async function run() {
      try {
        setIsLoadingAttributes(true);

        const data = await fetch_attributes();

        if (!is_active) {
          return;
        }

        setAttributeColumns(data?.attribute_columns ?? []);
        setEmployees(data?.rows ?? []);
        setCanEditValues(Boolean(data?.can_edit_values));
        setIsMemberView(Boolean(data?.is_member_view));
      } catch (error) {
        if (!is_active) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data atribut.",
        );
      } finally {
        if (is_active) {
          setIsLoadingAttributes(false);
        }
      }
    }

    void run();

    return () => {
      is_active = false;
    };
  }, [fetch_attributes]);

  useEffect(() => {
    const socket = get_socket();

    const refresh_attributes = () => {
      void load_attributes().catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memperbarui data atribut realtime.",
        );
      });
    };

    socket.on("connect", refresh_attributes);
    socket.on("attribute.master.changed", refresh_attributes);
    socket.on("attribute.value.changed", refresh_attributes);
    socket.on("attribute.sync.completed", refresh_attributes);

    return () => {
      socket.off("connect", refresh_attributes);
      socket.off("attribute.master.changed", refresh_attributes);
      socket.off("attribute.value.changed", refresh_attributes);
      socket.off("attribute.sync.completed", refresh_attributes);
    };
  }, [load_attributes]);

  const handle_sync_attributes = async () => {
    try {
      setSyncStatus("syncing");
      setIsLoadingAttributes(true);
      await load_attributes();
      toast.success("Data atribut InsanKu berhasil disinkronkan.");
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Sinkronisasi data atribut gagal dijalankan.",
      );
    } finally {
      setSyncStatus("idle");
      setIsLoadingAttributes(false);
    }
  };

  const filterable_attribute_columns = useMemo(
    () =>
      attribute_columns.filter((column) =>
        ["checkbox", "date", "number"].includes(column.type),
      ),
    [attribute_columns],
  );

  const filtered_employees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const active_attribute_filters = Object.entries(attribute_filters).filter(
      ([attribute_key, value]) =>
        filterable_attribute_columns.some(
          (column) => column.key === attribute_key,
        ) &&
        (typeof value === "object" && value !== null
          ? Object.values(value).some(
              (item) => String(item ?? "").trim() !== "",
            )
          : String(value ?? "").trim() !== ""),
    );

    if (!keyword && !active_attribute_filters.length) {
      return employees;
    }

    return employees.filter((employee) => {
      const matches_keyword =
        !keyword ||
        String(employee.name ?? "").toLowerCase().includes(keyword);

      const matches_attributes = active_attribute_filters.every(
        ([attribute_key, filter_value]) => {
          const column = attribute_columns.find(
            (item) => item.key === attribute_key,
          );
          const employee_value = employee.attribute_values?.[attribute_key];

          if (column?.type === "checkbox") {
            return String(Boolean(employee_value)) === filter_value;
          }

          if (column?.type === "number") {
            const raw_value = String(employee_value ?? "").trim();
            const numeric_value = Number(employee_value);
            const minimum = String(filter_value.min ?? "").trim();
            const maximum = String(filter_value.max ?? "").trim();

            return (
              Boolean(raw_value) &&
              Number.isFinite(numeric_value) &&
              (!minimum || numeric_value >= Number(minimum)) &&
              (!maximum || numeric_value <= Number(maximum))
            );
          }

          if (column?.type === "date") {
            const date_value = String(employee_value ?? "").slice(0, 10);
            const from_date = String(filter_value.from ?? "").trim();
            const to_date = String(filter_value.to ?? "").trim();

            return (
              Boolean(date_value) &&
              (!from_date || date_value >= from_date) &&
              (!to_date || date_value <= to_date)
            );
          }

          return true;
        },
      );

      return matches_keyword && matches_attributes;
    });
  }, [
    attribute_columns,
    attribute_filters,
    employees,
    filterable_attribute_columns,
    search,
  ]);

  const active_employees = useMemo(
    () => filtered_employees.filter((employee) => employee.is_active),
    [filtered_employees],
  );

  const non_active_employees = useMemo(
    () => filtered_employees.filter((employee) => !employee.is_active),
    [filtered_employees],
  );

  const export_employees = useMemo(
    () =>
      employees.filter((employee) =>
        active_tab === "aktif" ? employee.is_active : !employee.is_active,
      ),
    [active_tab, employees],
  );

  const tab_employees = useMemo(
    () => (active_tab === "aktif" ? active_employees : non_active_employees),
    [active_employees, active_tab, non_active_employees],
  );

  const sorted_employees = useMemo(() => {
    return [...tab_employees].sort((first, second) => {
      const first_value = sort_key.startsWith("attribute:")
        ? first.attribute_values?.[sort_key.replace("attribute:", "")]
        : first[sort_key];
      const second_value = sort_key.startsWith("attribute:")
        ? second.attribute_values?.[sort_key.replace("attribute:", "")]
        : second[sort_key];
      const result = compare_value(first_value, second_value);

      return sort_direction === "asc" ? result : -result;
    });
  }, [sort_direction, sort_key, tab_employees]);

  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_employees, PAGE_SIZE);

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

  const handle_search_change = (event) => {
    setSearch(event.target.value);
    setCurrentPage(1);
  };

  const handle_tab_change = (next_tab) => {
    setActiveTab(next_tab);
    setCurrentPage(1);
  };

  const handle_import = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsImporting(true);

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

      const username_column_index = header_indexes.get("username");

      if (!username_column_index) {
        throw new Error("File Excel wajib memiliki kolom Username.");
      }

      const imported_attributes = attribute_columns
        .map((column) => ({
          ...column,
          column_index: header_indexes.get(column.label.trim().toLowerCase()),
        }))
        .filter((column) => column.column_index);

      if (!imported_attributes.length) {
        throw new Error("Tidak ada kolom atribut yang cocok dengan sistem.");
      }

      const rows = [];

      worksheet.eachRow({ includeEmpty: false }, (row, row_number) => {
        if (row_number === 1) {
          return;
        }

        const username = String(
          get_excel_cell_value(row.getCell(username_column_index).value),
        ).trim();

        if (!username) {
          return;
        }

        rows.push({
          username,
          values: Object.fromEntries(
            imported_attributes.map((column) => [
              column.key,
              get_excel_cell_value(row.getCell(column.column_index).value),
            ]),
          ),
        });
      });

      if (!rows.length) {
        throw new Error("File Excel tidak memiliki data InsanKu.");
      }

      const response = await fetch("/api/atribut-insanku", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active_tab,
          rows,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Impor atribut InsanKu gagal.");
      }

      await load_attributes();
      toast.success(payload.message || "Data atribut berhasil diimpor dari Excel.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Data atribut gagal diimpor dari Excel.",
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handle_export = async () => {
    if (!export_employees.length) {
      toast.info("Tidak ada data yang dapat diekspor.");
      return;
    }

    try {
      const exceljs_module = await import("exceljs");
      const ExcelJS = exceljs_module.default ?? exceljs_module;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(
        active_tab === "aktif" ? "InsanKu Aktif" : "InsanKu Non-Aktif",
      );

      worksheet.columns = [
        { header: "Nama", key: "name", width: 28 },
        { header: "Username", key: "username", width: 22 },
        ...attribute_columns.map((column) => ({
          header: column.label,
          key: column.key,
          width: Math.max(column.label.length + 4, 18),
        })),
      ];
      export_employees.forEach((employee) => {
        worksheet.addRow({
          name: employee.name,
          username: employee.username,
          ...Object.fromEntries(
            attribute_columns.map((column) => {
              const value = employee.attribute_values?.[column.key];

              return [
                column.key,
                column.type === "checkbox" ? (value ? "Ya" : "Tidak") : value,
              ];
            }),
          ),
        });
      });

      const header_row = worksheet.getRow(1);
      header_row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header_row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" },
      };
      header_row.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      const workbook_buffer = await workbook.xlsx.writeBuffer();
      const excel_blob = new Blob([workbook_buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const download_url = URL.createObjectURL(excel_blob);
      const download_link = document.createElement("a");
      const tab_label = active_tab === "aktif" ? "aktif" : "non-aktif";

      download_link.href = download_url;
      download_link.download = `atribut-insanku-${tab_label}.xlsx`;
      document.body.appendChild(download_link);
      download_link.click();
      download_link.remove();
      URL.revokeObjectURL(download_url);
      toast.success("Data atribut berhasil diekspor ke Excel.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Data atribut gagal diekspor ke Excel.",
      );
    }
  };

  const open_filter_modal = () => {
    setDraftAttributeFilters(attribute_filters);
    setIsFilterModalOpen(true);
  };

  const handle_apply_filters = () => {
    setAttributeFilters(draft_attribute_filters);
    setIsFilterModalOpen(false);
    setCurrentPage(1);
  };

  const handle_reset_filters = () => {
    setDraftAttributeFilters({});
    setAttributeFilters({});
    setCurrentPage(1);
  };

  const update_cell_key = (uuid_insanku, uuid_atribut) => `${uuid_insanku}:${uuid_atribut}`;

  const persist_attribute_value = async ({
    uuid_insanku,
    uuid_atribut,
    next_value,
    previous_value,
  }) => {
    const cell_key = update_cell_key(uuid_insanku, uuid_atribut);

    setSavingCells((current) => ({
      ...current,
      [cell_key]: true,
    }));

    setEmployees((current) =>
      current.map((employee) =>
        employee.uuid === uuid_insanku
          ? {
              ...employee,
              attribute_values: {
                ...employee.attribute_values,
                [uuid_atribut]: next_value,
              },
            }
          : employee,
      ),
    );

    try {
      const response = await fetch("/api/atribut-insanku", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_insanku,
          uuid_atribut,
          value: next_value,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui atribut.");
      }
    } catch (error) {
      setEmployees((current) =>
        current.map((employee) =>
          employee.uuid === uuid_insanku
            ? {
                ...employee,
                attribute_values: {
                  ...employee.attribute_values,
                  [uuid_atribut]: previous_value,
                },
              }
            : employee,
        ),
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui atribut.",
      );
    } finally {
      setSavingCells((current) => {
        const next = { ...current };
        delete next[cell_key];
        return next;
      });
    }
  };

  const render_attribute_input = (employee, column) => {
    const cell_key = update_cell_key(employee.uuid, column.key);
    const is_saving = Boolean(saving_cells[cell_key]);
    const current_value = employee.attribute_values?.[column.key];
    const is_disabled =
      is_saving ||
      !can_edit_values ||
      (is_member_view && !column.is_edit);

    if (column.type === "checkbox") {
      return (
        <div className="flex items-center justify-center">
          <label className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={Boolean(current_value)}
              disabled={is_disabled}
              onChange={(event) =>
                persist_attribute_value({
                  uuid_insanku: employee.uuid,
                  uuid_atribut: column.key,
                  next_value: event.target.checked,
                  previous_value: Boolean(current_value),
                })}
              className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/50"
            />
          </label>
        </div>
      );
    }

    return (
      <Input
        type={column.type === "number" ? "number" : column.type === "date" ? "date" : "text"}
        value={String(current_value ?? "")}
        disabled={is_disabled}
        onChange={(event) => {
          const changed_value = event.target.value;

          setEmployees((current) =>
            current.map((item) =>
              item.uuid === employee.uuid
                ? {
                    ...item,
                    attribute_values: {
                      ...item.attribute_values,
                      [column.key]: changed_value,
                    },
                  }
                : item,
            ),
          );
        }}
        onBlur={(event) =>
          persist_attribute_value({
            uuid_insanku: employee.uuid,
            uuid_atribut: column.key,
            next_value: event.target.value,
            previous_value: String(current_value ?? ""),
          })}
        className="h-9 min-w-[140px]"
      />
    );
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Atribut InsanKu"
          description="Pantau kelengkapan atribut InsanKu."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={handle_tab_change} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <p className="text-sm leading-5">
                Data atribut InsanKu diperbarui secara real-time. Sinkronisasi dapat dilakukan kapan saja jika diperlukan.
              </p>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p className="text-sm leading-5">
                Data InsanKu bersumber dari <strong>SlipGaji</strong>. Jika belum
                terbaru, {" "}
                <strong>
                  sinkronkan melalui menu Pengguna pada tab InsanKu
                </strong>
                .
              </p>
            </div>
          </div>

          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
            <TabsTrigger value="aktif" className="min-w-max px-4 py-2">
              InsanKu Aktif
            </TabsTrigger>
            <TabsTrigger value="non-aktif" className="min-w-max px-4 py-2">
              InsanKu Non-Aktif
            </TabsTrigger>
          </TabsList>

          <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <CardTitle className="min-w-0 flex-1">
                {active_tab === "aktif"
                  ? "Data Atribut InsanKu Aktif"
                  : "Data Atribut InsanKu Non-Aktif"}
              </CardTitle>
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  onClick={() => import_input_ref.current?.click()}
                  disabled={is_importing}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                >
                  {is_importing ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : (
                    <FileSpreadsheetIcon className="size-4" />
                  )}
                  Impor
                </Button>
                <Input
                  ref={import_input_ref}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handle_import}
                  className="sr-only"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  onClick={handle_export}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                >
                  <FileSpreadsheetIcon className="size-4" />
                  Ekspor
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-sm">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={handle_search_change}
                    placeholder="Cari nama InsanKu..."
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={open_filter_modal}
                  className="w-full gap-2 sm:w-auto"
                >
                  <FilterIcon className="size-4" />
                  Filter Lanjutan
                </Button>
                <SyncActionButton
                  onConfirm={handle_sync_attributes}
                  description="Sinkronisasi akan memuat ulang data atribut InsanKu terbaru yang tersedia di sistem."
                  isPending={sync_status === "syncing"}
                  className="w-full sm:ml-auto sm:w-auto"
                />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[560px] overflow-auto">
                  <Table containerClassName="overflow-visible">
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow>
                        <TableHead className="sticky top-0 left-0 z-30 min-w-[240px] bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                          <SortableTableHead
                            label="Nama"
                            sortKey="name"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        {attribute_columns.map((column) => (
                          <TableHead
                            key={column.key}
                            className="sticky top-0 z-20 min-w-[160px] bg-card text-center"
                          >
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {is_loading_attributes ? (
                        <TableRow>
                          <TableCell
                            colSpan={attribute_columns.length + 2}
                            className="h-28 text-center text-muted-foreground"
                          >
                            <span className="inline-flex items-center gap-2">
                              <LoaderCircleIcon className="size-4 animate-spin" />
                              Memuat data...
                            </span>
                          </TableCell>
                        </TableRow>
                      ) : paginated_rows.length ? (
                        paginated_rows.map((employee, index) => (
                          <TableRow key={employee.uuid}>
                            <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                              {employee.name}
                            </TableCell>
                            {attribute_columns.map((column) => (
                              <TableCell key={`${employee.uuid}-${column.key}`}>
                                {render_attribute_input(employee, column)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={attribute_columns.length + 2}
                            className="h-28 text-center text-muted-foreground"
                          >
                            Data tidak tersedia.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {sorted_employees.length ? (
                  <Pagination
                    current_page={current_page}
                    page_size={PAGE_SIZE}
                    total_items={sorted_employees.length}
                    total_pages={total_pages}
                    item_label="InsanKu"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                ) : null}
              </div>
            </div>
          </CardContent>
          </Card>
        </Tabs>
      </div>

      <DialogPrimitive.Root
        open={is_filter_modal_open}
        onOpenChange={setIsFilterModalOpen}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                  Filter Lanjutan
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  Pilih status atau rentang atribut untuk menyaring data InsanKu.
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
              {filterable_attribute_columns.length ? (
                filterable_attribute_columns.map((column) => (
                  <div key={column.key} className="space-y-2">
                    <Label
                      htmlFor={`filter-${column.key}`}
                    >
                      {column.label}
                    </Label>
                    {column.type === "checkbox" ? (
                      <select
                        id={`filter-${column.key}`}
                        value={draft_attribute_filters[column.key] ?? ""}
                        onChange={(event) =>
                          setDraftAttributeFilters((current) => ({
                            ...current,
                            [column.key]: event.target.value,
                          }))}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">Semua</option>
                        <option value="true">Ya</option>
                        <option value="false">Tidak</option>
                      </select>
                    ) : column.type === "number" ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`filter-${column.key}`}>Minimum</Label>
                          <Input
                            id={`filter-${column.key}`}
                            type="number"
                            value={draft_attribute_filters[column.key]?.min ?? ""}
                            onChange={(event) =>
                              setDraftAttributeFilters((current) => ({
                                ...current,
                                [column.key]: {
                                  ...current[column.key],
                                  min: event.target.value,
                                },
                              }))}
                            placeholder="Nilai minimum"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`filter-${column.key}-max`}>Maksimum</Label>
                          <Input
                            id={`filter-${column.key}-max`}
                            type="number"
                            value={draft_attribute_filters[column.key]?.max ?? ""}
                            onChange={(event) =>
                              setDraftAttributeFilters((current) => ({
                                ...current,
                                [column.key]: {
                                  ...current[column.key],
                                  max: event.target.value,
                                },
                              }))}
                            placeholder="Nilai maksimum"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`filter-${column.key}`}>Dari</Label>
                          <Input
                            id={`filter-${column.key}`}
                            type="date"
                            value={draft_attribute_filters[column.key]?.from ?? ""}
                            onChange={(event) =>
                              setDraftAttributeFilters((current) => ({
                                ...current,
                                [column.key]: {
                                  ...current[column.key],
                                  from: event.target.value,
                                },
                              }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`filter-${column.key}-to`}>Sampai</Label>
                          <Input
                            id={`filter-${column.key}-to`}
                            type="date"
                            value={draft_attribute_filters[column.key]?.to ?? ""}
                            onChange={(event) =>
                              setDraftAttributeFilters((current) => ({
                                ...current,
                                [column.key]: {
                                  ...current[column.key],
                                  to: event.target.value,
                                },
                              }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada atribut yang dapat difilter.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse justify-between gap-2 border-t p-5 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={handle_reset_filters}
              >
                Reset Filter
              </Button>
              <div className="flex justify-end gap-2">
                <DialogPrimitive.Close
                  render={
                    <Button type="button" variant="outline" />
                  }
                >
                  Batal
                </DialogPrimitive.Close>
                <Button type="button" onClick={handle_apply_filters}>
                  Terapkan Filter
                </Button>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
