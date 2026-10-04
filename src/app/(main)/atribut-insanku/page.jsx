"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronDownIcon,
  FileSpreadsheetIcon,
  FilterIcon,
  InfoIcon,
  LoaderCircleIcon,
  MoveRightIcon,
  SearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import FilterField from "@/components/filter-field";
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
import FieldLabel from "@/components/field-label";
import { Input } from "@/components/ui/input";
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
const ATTRIBUTE_CARD_STYLES = [
  "border-sky-200 bg-sky-50/80 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-50",
  "border-violet-200 bg-violet-50/80 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50",
  "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50",
  "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50",
  "border-rose-200 bg-rose-50/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50",
  "border-cyan-200 bg-cyan-50/80 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50",
];

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

function get_date_range_days(start_value, end_value) {
  const start_date = String(start_value ?? "").trim();
  const end_date = String(end_value ?? "").trim();

  if (!start_date || !end_date) {
    return null;
  }

  const start_timestamp = Date.parse(`${start_date}T00:00:00`);
  const end_timestamp = Date.parse(`${end_date}T00:00:00`);

  if (
    !Number.isFinite(start_timestamp) ||
    !Number.isFinite(end_timestamp) ||
    end_timestamp < start_timestamp
  ) {
    return null;
  }

  return Math.floor((end_timestamp - start_timestamp) / 86400000) + 1;
}

function employee_has_attribute_value(employee, column) {
  const value = employee.attribute_values?.[column.key];

  if (column.type === "checkbox") {
    return value === true;
  }

  return String(value ?? "").trim() !== "";
}

export default function AtributInsanKuPage() {
  const [attribute_columns, setAttributeColumns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [active_category, setActiveCategory] = useState("slip-gaji");
  const [active_tab, setActiveTab] = useState("aktif");
  const [can_edit_values, setCanEditValues] = useState(false);
  const [can_manage_attributes, setCanManageAttributes] = useState(false);
  const [is_member_view, setIsMemberView] = useState(true);
  const [search, setSearch] = useState("");
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const [is_loading_attributes, setIsLoadingAttributes] = useState(true);
  const [saving_cells, setSavingCells] = useState({});
  const [sync_status, setSyncStatus] = useState("idle");
  const [is_importing, setIsImporting] = useState(false);
  const [is_filter_modal_open, setIsFilterModalOpen] = useState(false);
  const [is_summary_open, setIsSummaryOpen] = useState(true);
  const [is_export_modal_open, setIsExportModalOpen] = useState(false);
  const [attribute_filters, setAttributeFilters] = useState({});
  const [draft_attribute_filters, setDraftAttributeFilters] = useState({});
  const import_input_ref = useRef(null);
  const previous_cell_values_ref = useRef({});
  const can_import_export = can_manage_attributes;
  const can_sync_attributes = is_member_view || can_manage_attributes;

  const fetch_attributes = useCallback(async () => {
    const response = await fetch("/api/atribut-insanku", {
      cache: "no-store",
    });
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
    setCanManageAttributes(Boolean(data?.can_manage_attributes));
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
        setCanManageAttributes(Boolean(data?.can_manage_attributes));
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
            : "Gagal memperbarui data atribut otomatis.",
        );
        });
    };

    const apply_attribute_value = ({ uuid_insanku, uuid_atribut, value }) => {
      if (!uuid_insanku || !uuid_atribut) {
        return;
      }

      setEmployees((current) =>
        current.map((employee) => {
          if (employee.uuid !== uuid_insanku) {
            return employee;
          }

          const filled_attribute_keys = employee.filled_attribute_keys ?? [];

          return {
            ...employee,
            filled_attribute_keys: filled_attribute_keys.includes(uuid_atribut)
              ? filled_attribute_keys
              : [...filled_attribute_keys, uuid_atribut],
            attribute_values: {
              ...employee.attribute_values,
              [uuid_atribut]: value,
            },
          };
        }),
      );
    };

    socket.on("connect", refresh_attributes);
    socket.on("attribute.master.changed", refresh_attributes);
    socket.on("attribute.value.changed", apply_attribute_value);
    socket.on("attribute.sync.completed", refresh_attributes);

    return () => {
      socket.off("connect", refresh_attributes);
      socket.off("attribute.master.changed", refresh_attributes);
      socket.off("attribute.value.changed", apply_attribute_value);
      socket.off("attribute.sync.completed", refresh_attributes);
    };
  }, [load_attributes]);

  const handle_sync_attributes = async () => {
    try {
      setSyncStatus("syncing");
      setIsLoadingAttributes(true);
      const response = await fetch("/api/atribut-insanku", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: is_member_view ? "sync-data" : "sync-by-nik",
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || "Sinkronisasi data atribut gagal dijalankan.",
        );
      }

      await load_attributes();
      toast.success(payload.message || "Data atribut InsanKu berhasil disinkronkan.");
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

    const category_employees = is_member_view
      ? employees
      : employees.filter(
          (employee) =>
            employee.is_slip_gaji_account === (active_category === "slip-gaji"),
        );

    if (!keyword && !active_attribute_filters.length) {
      return category_employees;
    }

    return category_employees.filter((employee) => {
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
    active_category,
    employees,
    filterable_attribute_columns,
    is_member_view,
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
      is_member_view
        ? employees
        : employees.filter((employee) =>
            employee.is_slip_gaji_account === (active_category === "slip-gaji") &&
            (active_tab === "aktif" ? employee.is_active : !employee.is_active),
          ),
    [active_category, active_tab, employees, is_member_view],
  );

  const required_attribute_columns = useMemo(
    () => attribute_columns.filter((column) => column.is_attribute),
    [attribute_columns],
  );

  const is_attribute_complete = useCallback(
    (employee) =>
      required_attribute_columns.every((column) =>
        employee_has_attribute_value(employee, column),
      ),
    [required_attribute_columns],
  );

  const complete_export_employees = useMemo(
    () => export_employees.filter(is_attribute_complete),
    [export_employees, is_attribute_complete],
  );

  const incomplete_export_employees = useMemo(
    () => export_employees.filter((employee) => !is_attribute_complete(employee)),
    [export_employees, is_attribute_complete],
  );

  const attribute_summary_cards = useMemo(
    () =>
      required_attribute_columns
        .filter((column) => column.is_summary_visible)
        .map((column) => {
          const filled_count = export_employees.filter((employee) =>
            employee_has_attribute_value(employee, column),
          ).length;

          return {
            key: column.key,
            label: column.label,
            filled_count,
            total_count: export_employees.length,
          };
        }),
    [export_employees, required_attribute_columns],
  );

  const display_attribute_columns = useMemo(() => {
    const attribute_by_uuid = new Map(
      attribute_columns.map((column) => [column.key, column]),
    );
    return attribute_columns.map((column) => ({
      ...column,
      range_column:
        column.type === "date" ? attribute_by_uuid.get(column.range_with) : null,
    }));
  }, [attribute_columns]);

  const tab_employees = useMemo(
    () => is_member_view
      ? filtered_employees
      : active_tab === "aktif"
        ? active_employees
        : non_active_employees,
    [
      active_employees,
      active_tab,
      filtered_employees,
      is_member_view,
      non_active_employees,
    ],
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

  const table_column_count = display_attribute_columns.length + 3;

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

  const handle_category_change = (next_category) => {
    setActiveCategory(next_category);
    setActiveTab("aktif");
    setCurrentPage(1);
  };

  const handle_import = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (!can_import_export) {
        throw new Error("Akun outlet tidak memiliki akses impor.");
      }

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
          active_category,
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

  const handle_export = async (export_scope) => {
    if (!can_import_export) {
      toast.error("Akun outlet tidak memiliki akses ekspor.");
      return;
    }

    const selected_employees =
      export_scope === "complete"
        ? complete_export_employees
        : incomplete_export_employees;

    if (!selected_employees.length) {
      toast.info("Tidak ada data yang dapat diekspor.");
      return;
    }

    try {
      const exceljs_module = await import("exceljs");
      const ExcelJS = exceljs_module.default ?? exceljs_module;
      const workbook = new ExcelJS.Workbook();
      const category_label =
        active_category === "slip-gaji" ? "Slip Gaji" : "Non Slip Gaji";
      const worksheet = workbook.addWorksheet(
        `${category_label} - ${active_tab === "aktif" ? "Aktif" : "Non-Aktif"}`,
      );

      worksheet.columns = [
        { header: "NIK", key: "nik", width: 18 },
        { header: "Nama", key: "name", width: 28 },
        { header: "Username", key: "username", width: 22 },
        ...attribute_columns.map((column) => ({
          header: column.label,
          key: column.key,
          width: Math.max(column.label.length + 4, 18),
        })),
      ];
      selected_employees.forEach((employee) => {
        worksheet.addRow({
          nik: employee.nik,
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
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { ...cell.font, name: "Aptos", size: 12 };
          cell.alignment = {
            ...cell.alignment,
            vertical: "middle",
            wrapText: true,
          };
        });
      });
      worksheet.columns.forEach((column) => {
        let maximum_content_length = 0;

        column.eachCell({ includeEmpty: false }, (cell) => {
          const longest_line_length = String(cell.text ?? cell.value ?? "")
            .split("\n")
            .reduce((maximum_length, line) => Math.max(maximum_length, line.length), 0);

          maximum_content_length = Math.max(
            maximum_content_length,
            longest_line_length,
          );
        });
        column.width = Math.min(28, Math.max(12, maximum_content_length + 2));
      });

      const workbook_buffer = await workbook.xlsx.writeBuffer();
      const excel_blob = new Blob([workbook_buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const download_url = URL.createObjectURL(excel_blob);
      const download_link = document.createElement("a");
      const tab_label = active_tab === "aktif" ? "aktif" : "non-aktif";

      download_link.href = download_url;
      download_link.download = `atribut-insanku-${active_category}-${tab_label}.xlsx`;
      document.body.appendChild(download_link);
      download_link.click();
      download_link.remove();
      URL.revokeObjectURL(download_url);
      setIsExportModalOpen(false);
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

  const handle_filter_modal_open_change = (next_open) => {
    if (!next_open) {
      setDraftAttributeFilters({});
    }

    setIsFilterModalOpen(next_open);
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

    if (Object.is(next_value, previous_value)) {
      delete previous_cell_values_ref.current[cell_key];
      return;
    }

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

      setEmployees((current) =>
        current.map((employee) => {
          if (employee.uuid !== uuid_insanku) {
            return employee;
          }

          const filled_attribute_keys = employee.filled_attribute_keys ?? [];

          return {
            ...employee,
            filled_attribute_keys: filled_attribute_keys.includes(uuid_atribut)
              ? filled_attribute_keys
              : [...filled_attribute_keys, uuid_atribut],
            attribute_values: {
              ...employee.attribute_values,
              [uuid_atribut]: payload.data?.value ?? next_value,
            },
          };
        }),
      );
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
      delete previous_cell_values_ref.current[cell_key];
      setSavingCells((current) => {
        const next = { ...current };
        delete next[cell_key];
        return next;
      });
    }
  };

  const render_attribute_control = (employee, column) => {
    const cell_key = update_cell_key(employee.uuid, column.key);
    const is_saving = Boolean(saving_cells[cell_key]);
    const current_value = employee.attribute_values?.[column.key];
    const is_read_only =
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
              onClick={(event) => {
                if (is_read_only) {
                  event.preventDefault();
                }
              }}
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
        readOnly={is_read_only}
        onFocus={() => {
          previous_cell_values_ref.current[cell_key] = String(
            current_value ?? "",
          );
        }}
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
            previous_value:
              previous_cell_values_ref.current[cell_key] ??
              String(current_value ?? ""),
          })}
        className="h-9 min-w-[140px]"
      />
    );
  };

  const render_attribute_input = (employee, column) => {
    if (!column.range_column) {
      return render_attribute_control(employee, column);
    }

    const range_days = get_date_range_days(
      employee.attribute_values?.[column.key],
      employee.attribute_values?.[column.range_column.key],
    );

    return (
      <div className="flex items-center gap-2">
        {render_attribute_control(employee, column)}
        {range_days !== null ? (
          <span className="shrink-0 text-xs font-semibold text-primary">
            {range_days} hari
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Atribut InsanKu"
          description={
            is_member_view
              ? "Lihat atribut InsanKu yang terhubung dengan outlet Anda."
              : "Pantau dan kelola kelengkapan atribut InsanKu."
          }
        />
      </div>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-6">
          <div
            className={
              can_manage_attributes && active_category === "slip-gaji"
                ? "grid gap-6 md:grid-cols-2"
                : "grid gap-6"
            }
          >
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-sky-600" />
              <p className="text-sm leading-5">
                {is_member_view
                  ? "Data atribut InsanKu outlet diperbarui otomatis. Anda juga dapat memuat ulang data kapan saja."
                  : "Data atribut InsanKu diperbarui otomatis. Anda juga dapat memuat ulang data kapan saja."}
              </p>
            </div>

            {can_manage_attributes && active_category === "slip-gaji" ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-sm leading-5">
                  Data InsanKu bersumber dari <strong>SlipGaji</strong>. Jika belum
                  terbaru, {" "}
                  <strong>
                    sinkronkan melalui menu Pengguna pada tab InsanKu (Slip Gaji)
                  </strong>
                  .
                </p>
              </div>
            ) : null}
          </div>

          {can_manage_attributes ? (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Tabs value={active_category} onValueChange={handle_category_change}>
                  <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
                  <TabsTrigger value="slip-gaji" className="min-w-max flex-1 px-4 py-2">
                    InsanKu (Slip Gaji)
                    </TabsTrigger>
                    <TabsTrigger value="non-slip-gaji" className="min-w-max flex-1 px-4 py-2">
                      InsanKu (Non Slip Gaji)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <Tabs value={active_tab} onValueChange={handle_tab_change}>
                  <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
                    <TabsTrigger value="aktif" className="min-w-max flex-1 px-4 py-2">
                      Aktif
                    </TabsTrigger>
                    <TabsTrigger value="non-aktif" className="min-w-max flex-1 px-4 py-2">
                      Non-Aktif
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </>
          ) : null}

          {attribute_summary_cards.length ? (
            <Card className="gap-0 border-t-2 border-t-primary/70">
              <button
                type="button"
                onClick={() => setIsSummaryOpen((current) => !current)}
                aria-expanded={is_summary_open}
                aria-label={`${is_summary_open ? "Sembunyikan" : "Tampilkan"} ringkasan atribut`}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="font-heading text-base font-semibold tracking-tight">
                  Ringkasan Atribut
                </span>
                <ChevronDownIcon
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${is_summary_open ? "rotate-180" : ""}`}
                />
              </button>
              {is_summary_open ? (
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {attribute_summary_cards.map((summary, index) => (
                      <Card
                        key={summary.key}
                        className={`border px-4 py-3 ${ATTRIBUTE_CARD_STYLES[index % ATTRIBUTE_CARD_STYLES.length]}`}
                      >
                        <p className="truncate text-sm font-medium opacity-75">
                          {summary.label}
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {summary.filled_count.toLocaleString("id-ID")} / {summary.total_count.toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs opacity-70">
                          InsanKu sudah memiliki atribut
                        </p>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <Card className="gap-0 border-t-2 border-t-primary/70">
            <CardHeader className="border-b">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                <CardTitle className="min-w-0 flex-1">
                  {is_member_view
                    ? "Data Atribut InsanKu Outlet"
                    : `${active_category === "non-slip-gaji"
                        ? "Data Atribut InsanKu (Non Slip Gaji)"
                        : "Data Atribut InsanKu (Slip Gaji)"} ${
                        active_tab === "aktif" ? "Aktif" : "Non-Aktif"
                      }`}
                </CardTitle>
                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                  {can_import_export ? (
                    <>
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
                        onClick={() => setIsExportModalOpen(true)}
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                      >
                        <FileSpreadsheetIcon className="size-4" />
                        Ekspor
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <FilterField
                  label="Pencarian"
                  htmlFor="filter-pencarian-atribut-insanku"
                  className="w-full sm:max-w-sm"
                >
                  <div className="relative w-full">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="filter-pencarian-atribut-insanku"
                      value={search}
                      onChange={handle_search_change}
                      placeholder="Cari nama InsanKu..."
                      className="pl-9"
                    />
                  </div>
                </FilterField>
                <Button
                  type="button"
                  variant="outline"
                  onClick={open_filter_modal}
                  className="w-full gap-2 sm:w-auto"
                >
                  <FilterIcon className="size-4" />
                  Filter Lanjutan
                </Button>
                {active_category === "slip-gaji" && can_sync_attributes ? (
                  <SyncActionButton
                    onConfirm={handle_sync_attributes}
                    title={
                      is_member_view
                        ? "Konfirmasi sinkronisasi InsanKu outlet"
                        : "Konfirmasi sinkronisasi atribut InsanKu"
                    }
                    description={
                      is_member_view
                        ? "Sistem akan memperbarui data InsanKu dan penempatan outlet. Lanjutkan?"
                        : "Sistem juga akan mencocokkan NIK InsanKu Non Slip Gaji dengan Slip Gaji. Data atribut dengan NIK yang sama akan otomatis dioper ke akun Slip Gaji dan akun Non Slip Gaji dihapus permanen. Lanjutkan?"
                    }
                    confirmLabel="Ya, sinkronkan atribut"
                    isPending={sync_status === "syncing"}
                    className="w-full sm:ml-auto sm:w-auto"
                  />
                ) : null}
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[80vh] overflow-auto">
                  <Table containerClassName="overflow-visible">
                    <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableRow>
                      <TableHead className="sticky top-0 left-0 z-30 min-w-14 bg-card text-center shadow-[1px_0_0_0_hsl(var(--border))]">
                        No.
                      </TableHead>
                      <TableHead className="sticky top-0 left-14 z-30 min-w-[160px] bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                          <SortableTableHead
                            label="NIK"
                            sortKey="nik"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead className="sticky top-0 left-[216px] z-30 min-w-[240px] bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                          <SortableTableHead
                            label="Nama"
                            sortKey="name"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        {display_attribute_columns.map((column) => (
                          <TableHead
                            key={column.key}
                            className={`sticky top-0 z-20 min-w-[160px] bg-card text-center ${
                              column.range_column ? "h-auto py-2" : ""
                            }`}
                          >
                            {column.range_column ? (
                              <div className="flex flex-col gap-1 px-1">
                                <span>{column.label}</span>
                                <span className="text-xs font-normal leading-4 !text-white/80">
                                  Rentang dengan: {column.range_column.label}
                                </span>
                              </div>
                            ) : (
                              column.label
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {is_loading_attributes ? (
                        <TableRow>
                          <TableCell
                            colSpan={table_column_count}
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
                            <TableCell className="sticky left-0 z-10 bg-card text-center shadow-[1px_0_0_0_hsl(var(--border))]">
                              {(current_page - 1) * PAGE_SIZE + index + 1}
                            </TableCell>
                            <TableCell className="sticky left-14 z-10 bg-card shadow-[1px_0_0_0_hsl(var(--border))]">
                              {employee.nik || "-"}
                            </TableCell>
                            <TableCell className="sticky left-[216px] z-10 bg-card font-medium shadow-[1px_0_0_0_hsl(var(--border))]">
                              {employee.name}
                            </TableCell>
                            {display_attribute_columns.map((column) => (
                              <TableCell key={`${employee.uuid}-${column.key}`}>
                                {render_attribute_input(employee, column)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={table_column_count}
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
        </div>
      </div>

      <DialogPrimitive.Root
        open={is_export_modal_open}
        onOpenChange={setIsExportModalOpen}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <DialogPrimitive.Title className="font-heading text-xl font-semibold">
                  Ekspor Atribut InsanKu
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  Pilih daftar InsanKu yang ingin diekspor. Seluruh kolom atribut tetap disertakan.
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

            <div className="grid gap-3 p-5">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-between whitespace-normal px-4 py-3 text-left"
                onClick={() => void handle_export("complete")}
                disabled={!complete_export_employees.length}
              >
                <span>
                  <span className="block font-semibold">Sudah mendapatkan semua atribut</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {complete_export_employees.length} InsanKu
                  </span>
                </span>
                <FileSpreadsheetIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-between whitespace-normal px-4 py-3 text-left"
                onClick={() => void handle_export("incomplete")}
                disabled={!incomplete_export_employees.length}
              >
                <span>
                  <span className="block font-semibold">Belum mendapatkan semua atribut</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {incomplete_export_employees.length} InsanKu
                  </span>
                </span>
                <FileSpreadsheetIcon className="size-4" />
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root
        open={is_filter_modal_open}
        onOpenChange={handle_filter_modal_open_change}
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
                    <FieldLabel
                      htmlFor={`filter-${column.key}`}
                      label={column.label}
                      variant="filter"
                    />
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
                          <FieldLabel htmlFor={`filter-${column.key}`} label="Minimum" variant="filter" />
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
                          <FieldLabel htmlFor={`filter-${column.key}-max`} label="Maksimum" variant="filter" />
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
                      <div className="space-y-2">
                        <FieldLabel
                          htmlFor={`filter-${column.key}`}
                          label="Rentang Tanggal"
                          variant="filter"
                        />
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
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
                          <div className="flex items-center justify-center text-muted-foreground">
                            <MoveRightIcon className="size-4 rotate-90 sm:rotate-0" />
                            <span className="sr-only">sampai</span>
                          </div>
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
