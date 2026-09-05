"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  SearchIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import usePagination from "@/hooks/usePagination";

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

export default function AtributInsankuPage() {
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

  const fetch_attributes = async () => {
    const response = await fetch("/api/atribut-insanku");
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data atribut.");
    }

    return payload.data ?? {};
  };

  const load_attributes = async () => {
    const data = await fetch_attributes();

    setAttributeColumns(data?.attribute_columns ?? []);
    setEmployees(data?.rows ?? []);
    setCanEditValues(Boolean(data?.can_edit_values));
    setIsMemberView(Boolean(data?.is_member_view));
  };

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
  }, []);

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

  const filtered_employees = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return employees;
    }

    return employees.filter((employee) => {
      const searchable_values = [
        employee.name,
        employee.username,
        ...Object.values(employee.attribute_values ?? {}),
      ];

      return searchable_values.some((value) =>
        String(value ?? "").toLowerCase().includes(keyword),
      );
    });
  }, [employees, search]);

  const active_employees = useMemo(
    () => filtered_employees.filter((employee) => employee.is_active),
    [filtered_employees],
  );

  const non_active_employees = useMemo(
    () => filtered_employees.filter((employee) => !employee.is_active),
    [filtered_employees],
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

  const update_cell_key = (uuid_karyawan, uuid_atribut) => `${uuid_karyawan}:${uuid_atribut}`;

  const persist_attribute_value = async ({
    uuid_karyawan,
    uuid_atribut,
    next_value,
    previous_value,
  }) => {
    const cell_key = update_cell_key(uuid_karyawan, uuid_atribut);

    setSavingCells((current) => ({
      ...current,
      [cell_key]: true,
    }));

    setEmployees((current) =>
      current.map((employee) =>
        employee.uuid === uuid_karyawan
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
          uuid_karyawan,
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
          employee.uuid === uuid_karyawan
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
                  uuid_karyawan: employee.uuid,
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
            uuid_karyawan: employee.uuid,
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
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                >
                  <FileSpreadsheetIcon className="size-4" />
                  Impor
                </Button>
                <Button
                  type="button"
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
                    placeholder="Cari karyawan atau atribut..."
                    className="pl-9"
                  />
                </div>
                <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
                  <SyncActionButton
                    onConfirm={handle_sync_attributes}
                    description="Sinkronisasi akan memuat ulang data atribut InsanKu terbaru yang tersedia di sistem."
                    isPending={sync_status === "syncing"}
                    className="w-full sm:w-auto"
                  />
                </div>
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
                    item_label="karyawan"
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
    </>
  );
}
