"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AwardIcon,
  SearchIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import OptionDropdown from "@/components/option-dropdown";
import PageHeading from "@/components/page-heading";
import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import SyncActionButton from "@/components/sync-action-button";
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
import usePagination from "@/hooks/usePagination";

const PAGE_SIZE = 25;
const ALL = "all";
const LOAD_ERROR = "Gagal mengambil data nilai magang.";
const MONTH_OPTIONS = [
  { value: ALL, label: "Semua bulan" },
  ...[
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ].map((label, index) => ({ value: String(index + 1), label })),
];

function format_score(value) {
  return Number(value ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function score_class(value) {
  const numeric_value = Number(value);

  if (numeric_value >= 80) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (numeric_value >= 70) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (numeric_value >= 60) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function get_error_message(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

async function request_json(url, options, fallback) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || fallback);
  }

  return payload;
}

function filter_and_sort_rows(rows, search, sort_key, sort_direction) {
  const keyword = search.trim().toLocaleLowerCase("id-ID");
  const filtered_rows = keyword
    ? rows.filter((row) =>
        row.employee_name.toLocaleLowerCase("id-ID").includes(keyword),
      )
    : rows;
  const direction = sort_direction === "asc" ? 1 : -1;

  return [...filtered_rows].sort((first_row, second_row) => {
    const comparison =
      sort_key === "employee_name"
        ? first_row.employee_name.localeCompare(
            second_row.employee_name,
            "id-ID",
          )
        : Number(first_row.value) - Number(second_row.value);

    return comparison * direction;
  });
}

function SummaryCard({ label, value, icon: Icon, className, iconClassName }) {
  return (
    <Card className={`border ${className}`}>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={`rounded-xl border p-3 ${iconClassName}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function NilaiMagangPage() {
  const today = new Date();
  const [selected_month, setSelectedMonth] = useState(
    String(today.getMonth() + 1),
  );
  const [selected_year, setSelectedYear] = useState(
    String(today.getFullYear()),
  );
  const [selected_outlet, setSelectedOutlet] = useState(ALL);
  const [search, setSearch] = useState("");
  const [sort_key, setSortKey] = useState("value");
  const [sort_direction, setSortDirection] = useState("desc");
  const [data, setData] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [is_syncing, setIsSyncing] = useState(false);
  const [error_message, setErrorMessage] = useState("");

  const year_options = useMemo(() => {
    const current_year = new Date().getFullYear();

    return [
      { value: ALL, label: "Semua tahun" },
      ...Array.from({ length: current_year - 2018 + 1 }, (_, index) => ({
        value: String(current_year - index),
        label: String(current_year - index),
      })),
    ];
  }, []);
  const outlet_options = useMemo(
    () => [
      { value: ALL, label: "Semua outlet" },
      ...(data?.outlet_options ?? []),
    ],
    [data?.outlet_options],
  );

  const fetch_data = useCallback(async (signal) => {
    const search_params = new URLSearchParams({
      month: selected_month,
      year: selected_year,
      outlet_uuid: selected_outlet,
    });
    const payload = await request_json(
      `/api/nilai-magang?${search_params}`,
      { cache: "no-store", signal },
      LOAD_ERROR,
    );

    return payload.data;
  }, [selected_month, selected_outlet, selected_year]);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        setIsLoading(true);
        setData(await fetch_data(controller.signal));
        setErrorMessage("");
      } catch (error) {
        if (error?.name !== "AbortError") {
          setData(null);
          setErrorMessage(get_error_message(error, LOAD_ERROR));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      controller.abort();
    };
  }, [fetch_data]);

  const filtered_rows = useMemo(
    () =>
      filter_and_sort_rows(
        data?.rows ?? [],
        search,
        sort_key,
        sort_direction,
      ),
    [data?.rows, search, sort_direction, sort_key],
  );
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(filtered_rows, PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selected_month,
    selected_outlet,
    selected_year,
    setCurrentPage,
    sort_direction,
    sort_key,
  ]);

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection(next_sort_key === "employee_name" ? "asc" : "desc");
  };

  const handle_sync = async () => {
    if (selected_month === ALL || selected_year === ALL) {
      toast.error("Pilih bulan dan tahun tertentu sebelum sinkronisasi.");
      return;
    }

    try {
      setIsSyncing(true);
      const payload = await request_json(
        "/api/nilai-magang",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: selected_month,
            year: selected_year,
            outlet_uuid: selected_outlet,
          }),
        },
        "Sinkronisasi nilai magang gagal.",
      );

      setData(await fetch_data());
      setErrorMessage("");
      toast.success(payload.message || "Nilai magang berhasil disinkronkan.");
    } catch (error) {
      toast.error(get_error_message(error, "Sinkronisasi nilai magang gagal."));
    } finally {
      setIsSyncing(false);
    }
  };

  const summary_cards = [
    {
      label: "Total Mentee",
      value: (data?.summary?.total_mentee ?? 0).toLocaleString("id-ID"),
      icon: UsersRoundIcon,
      className:
        "border-sky-200 bg-sky-50/80 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-50",
      iconClassName:
        "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/70 dark:text-sky-300",
    },
    {
      label: "Rata-rata Nilai",
      value: format_score(data?.summary?.average),
      icon: AwardIcon,
      className:
        "border-violet-200 bg-violet-50/80 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50",
      iconClassName:
        "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/70 dark:text-violet-300",
    },
    {
      label: "Nilai Tertinggi",
      value: format_score(data?.summary?.highest),
      icon: TrendingUpIcon,
      className:
        "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50",
      iconClassName:
        "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300",
    },
    {
      label: "Nilai Terendah",
      value: format_score(data?.summary?.lowest),
      icon: TrendingDownIcon,
      className:
        "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50",
      iconClassName:
        "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/70 dark:text-amber-300",
    },
  ];
  const selected_month_label =
    MONTH_OPTIONS.find((item) => item.value === selected_month)?.label ??
    "bulan terpilih";
  const selected_year_label =
    year_options.find((item) => item.value === selected_year)?.label ??
    "tahun terpilih";
  const can_sync = selected_month !== ALL && selected_year !== ALL;

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Nilai Magang"
          description="Pantau nilai raport mentee berdasarkan periode dan outlet magang."
        />
      </div>

      <div className="space-y-4 px-4 lg:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary_cards.map((item) => (
            <SummaryCard key={item.label} {...item} />
          ))}
        </div>

        <Card className="border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>Data Nilai Raport Mentee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative w-full xl:max-w-md">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari nama mentee..."
                    className="pl-9"
                  />
                </div>
                <div className="w-full xl:w-72 xl:flex-none">
                  <OptionDropdown
                    value={selected_outlet}
                    onValueChange={setSelectedOutlet}
                    options={outlet_options}
                    searchable
                    searchPlaceholder="Cari outlet..."
                    emptySearchMessage="Outlet tidak ditemukan."
                    ariaLabel="Pilih outlet magang"
                  />
                </div>
                <div className="w-full xl:w-44">
                  <OptionDropdown
                    value={selected_month}
                    onValueChange={setSelectedMonth}
                    options={MONTH_OPTIONS}
                    ariaLabel="Pilih bulan nilai magang"
                  />
                </div>
                <div className="w-full xl:w-36">
                  <OptionDropdown
                    value={selected_year}
                    onValueChange={setSelectedYear}
                    options={year_options}
                    ariaLabel="Pilih tahun nilai magang"
                  />
                </div>
                <SyncActionButton
                  onConfirm={handle_sync}
                  title="Konfirmasi sinkronisasi nilai magang"
                  description={`Sinkronisasi akan mengambil nilai raport periode ${selected_month_label} ${selected_year_label} untuk ${outlet_options.find((item) => item.value === selected_outlet)?.label ?? "outlet terpilih"}.`}
                  isPending={is_syncing}
                  disabled={!can_sync}
                  className="w-full xl:ml-auto xl:w-auto"
                />
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24 text-center">Peringkat</TableHead>
                      <TableHead>
                        <SortableTableHead
                          label="Nama Mentee"
                          sortKey="employee_name"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                        />
                      </TableHead>
                      <TableHead>Outlet Magang</TableHead>
                      <TableHead className="w-36 text-center">
                        <SortableTableHead
                          label="Nilai Raport"
                          sortKey="value"
                          currentSortKey={sort_key}
                          sortDirection={sort_direction}
                          onSort={toggle_sort}
                          buttonClassName="justify-center"
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {is_loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                          Memuat data nilai magang...
                        </TableCell>
                      </TableRow>
                    ) : paginated_rows.length ? (
                      paginated_rows.map((row) => (
                        <TableRow key={row.uuid}>
                          <TableCell className="text-center font-semibold">
                            #{row.rank}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.employee_name}
                          </TableCell>
                          <TableCell>{row.outlet_name}</TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex min-w-20 justify-center rounded-full border px-3 py-1 font-semibold ${score_class(row.value)}`}
                            >
                              {format_score(row.value)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                          {error_message || "Belum ada data nilai magang untuk filter yang dipilih."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {filtered_rows.length ? (
                  <Pagination
                    current_page={current_page}
                    page_size={PAGE_SIZE}
                    total_items={filtered_rows.length}
                    total_pages={total_pages}
                    item_label="mentee"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
