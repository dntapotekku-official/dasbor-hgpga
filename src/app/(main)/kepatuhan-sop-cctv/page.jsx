"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  ChevronsUpDownIcon,
  ChevronDownIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  clearKepatuhanSopCctvCache,
  getKepatuhanSopCctvFromDb,
  primeKepatuhanSopCctvCache,
} from "@/lib/kepatuhanSopCctvClient";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const default_outlet = { value: "semua-outlet", label: "Semua Outlet" };

const chart_config = {
  total: {
    label: "Poin",
    color: "#2563eb",
  },
  total_point: {
    label: "Total Poin",
    color: "#f59e0b",
  },
};

const chart_series = [
  { key: "total", label: "Poin", className: "bg-blue-600" },
  { key: "total_point", label: "Total Poin", className: "bg-amber-500" },
];

const normalizeDashboardData = (payload, fallback_outlet_options = []) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const chart_data = Array.isArray(payload?.chart_data) ? payload.chart_data : [];
  const outlet_options_from_payload = Array.isArray(payload?.outlet_options)
    ? payload.outlet_options
    : rows.map((item) => ({
        value: item.uuid_outlet,
        label: item.nama_outlet,
      }));
  const outlet_options = Array.from(
    new Map(
      [...fallback_outlet_options, ...outlet_options_from_payload]
        .filter((item) => item?.value && item?.label)
        .map((item) => [item.value, item]),
    ).values(),
  );

  return {
    rows,
    outlet_options,
    chart_data,
  };
};

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

const formatChartDate = (value) => {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(date);
};

export default function KepatuhanSopCctvPage() {
  const default_date_range = useMemo(() => {
    const today = new Date();

    return {
      start_date: new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10),
      end_date: today.toISOString().slice(0, 10),
    };
  }, []);
  const [dashboard_data, setDashboardData] = useState(null);
  const [view_state, setViewState] = useState("loading");
  const [sync_status, setSyncStatus] = useState("idle");
  const [selected_outlet, setSelectedOutlet] = useState(default_outlet.value);
  const [start_date, setStartDate] = useState(default_date_range.start_date);
  const [end_date, setEndDate] = useState(default_date_range.end_date);
  const [is_outlet_menu_open, setIsOutletMenuOpen] = useState(false);
  const [outlet_search, setOutletSearch] = useState("");
  const [sort_key, setSortKey] = useState("nama_outlet");
  const [sort_direction, setSortDirection] = useState("asc");

  const outlet_options = useMemo(() => {
    const normalized_options = dashboard_data?.outlet_options
      ?.filter((item) => item?.value && item?.label)
      .map((item) => ({
        value: item.value,
        label: item.label,
      })) ?? [];

    return normalized_options.length
      ? [default_outlet, ...normalized_options]
      : [default_outlet];
  }, [dashboard_data]);
  const active_outlet = outlet_options.some((item) => item.value === selected_outlet)
    ? selected_outlet
    : default_outlet.value;
  const selected_outlet_label =
    outlet_options.find((outlet) => outlet.value === active_outlet)?.label ??
    default_outlet.label;
  const filtered_outlet_options = outlet_options.filter((outlet) =>
    outlet.label.toLowerCase().includes(outlet_search.trim().toLowerCase()),
  );
  const table_rows = useMemo(() => {
    const rows = dashboard_data?.rows ?? [];

    return active_outlet === default_outlet.value
      ? rows
      : rows.filter((item) => item.uuid_outlet === active_outlet);
  }, [active_outlet, dashboard_data]);
  const visible_rows = useMemo(() => {
    return [...table_rows].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      if (sort_key === "nama_outlet") {
        return (
          a.nama_outlet.localeCompare(b.nama_outlet, "id-ID") * direction
        );
      }

      return ((Number(a[sort_key]) || 0) - (Number(b[sort_key]) || 0)) * direction;
    });
  }, [sort_direction, sort_key, table_rows]);
  const chart_data = dashboard_data?.chart_data ?? [];

  const toggleSort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection(next_sort_key === "nama_outlet" ? "asc" : "desc");
  };

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        setViewState("loading");

        const response_data = await getKepatuhanSopCctvFromDb({
          tanggal_awal: start_date,
          tanggal_akhir: end_date,
          uuid_outlet:
            active_outlet === default_outlet.value ? undefined : active_outlet,
        });

        if (!is_active) {
          return;
        }

        setDashboardData((current_data) =>
          normalizeDashboardData(response_data.data, current_data?.outlet_options),
        );

        if (response_data.success) {
          setViewState(
            response_data.data?.rows?.length || response_data.data?.chart_data?.length
              ? "ready"
              : "empty",
          );
          return;
        }

        setViewState(response_data.status === 404 ? "empty" : "error");

        if (response_data.status !== 404) {
          toast.error(
            response_data.message || "Terjadi kesalahan saat mengambil data.",
          );
        }
      } catch (error) {
        if (!is_active) {
          return;
        }

        setDashboardData(normalizeDashboardData(null));
        setViewState("error");
        toast.error(
          error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil data.",
        );
      }
    };

    void run();

    return () => {
      is_active = false;
    };
  }, [active_outlet, end_date, start_date]);

  const syncKepatuhanSopCCTVHandler = async () => {
    try {
      setSyncStatus("loading");

      const sync_params = {
        tanggal_awal: start_date,
        tanggal_akhir: end_date,
        id_outlet:
          active_outlet === default_outlet.value ? undefined : active_outlet,
      };
      const cache_params = {
        tanggal_awal: start_date,
        tanggal_akhir: end_date,
        uuid_outlet:
          active_outlet === default_outlet.value ? undefined : active_outlet,
      };
      const response = await fetch("/api/kepatuhan-sop-cctv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sync_params),
      });
      const payload = await response.json();
      const response_data = {
        success: response.ok && payload.success,
        status: response.status,
        message: payload.message || "Sinkronisasi kepatuhan SOP CCTV gagal dijalankan.",
        data: payload.data,
      };

      if (!response_data.success) {
        throw new Error(response_data.message || "Sinkronisasi gagal dijalankan.");
      }

      clearKepatuhanSopCctvCache();
      primeKepatuhanSopCctvCache(cache_params, response_data);
      setDashboardData((current_data) =>
        normalizeDashboardData(response_data.data, current_data?.outlet_options),
      );
      setViewState(
        response_data.data?.rows?.length || response_data.data?.chart_data?.length
          ? "ready"
          : "empty",
      );
      toast.success(response_data.message || "Sinkronisasi kepatuhan SOP CCTV berhasil.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan saat sinkronisasi.");
    } finally {
      setSyncStatus("idle");
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Kepatuhan SOP CCTV"
          description="Pantau kepatuhan SOP CCTV hari terkini berdasarkan outlet."
        />
      </div>
      <div className="space-y-4 px-4 lg:px-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="grid gap-4 border-b pb-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <CardTitle className="text-xl">Tren Harian</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                {chart_series.map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <span className={`size-4 rounded-full ${item.className}`} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(220px,320px)_minmax(150px,170px)_minmax(150px,170px)_auto] sm:items-end lg:w-auto">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Outlet
                </span>
                <DropdownMenu
                  open={is_outlet_menu_open}
                  onOpenChange={(open) => {
                    setIsOutletMenuOpen(open);

                    if (!open) {
                      setOutletSearch("");
                    }
                  }}
                >
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between bg-card"
                      />
                    }
                  >
                    <span className="truncate">{selected_outlet_label}</span>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[320px]">
                    <div className="relative p-1">
                      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={outlet_search}
                        onChange={(event) => setOutletSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="Cari outlet..."
                        className="h-9 pl-8"
                      />
                    </div>
                    <DropdownMenuRadioGroup
                      value={active_outlet}
                      onValueChange={(outlet) => {
                        setSelectedOutlet(outlet);
                        setIsOutletMenuOpen(false);
                        setOutletSearch("");
                      }}
                    >
                      {filtered_outlet_options.map((outlet) => (
                        <DropdownMenuRadioItem
                          key={outlet.value}
                          value={outlet.value}
                          className="py-2 text-sm"
                        >
                          {outlet.label}
                        </DropdownMenuRadioItem>
                      ))}
                      {!filtered_outlet_options.length ? (
                        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                          Outlet tidak ditemukan.
                        </div>
                      ) : null}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Tanggal Awal
                </span>
                <Input
                  type="date"
                  value={start_date}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Tanggal Akhir
                </span>
                <Input
                  type="date"
                  value={end_date}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="bg-card"
                />
              </div>
              <Button
                type="button"
                onClick={syncKepatuhanSopCCTVHandler}
                disabled={sync_status === "loading"}
              >
                {sync_status === "loading" ? "Menyinkronkan..." : "Sinkron"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {chart_data.length ? (
              <div className="rounded-lg border p-4">
                <ChartContainer
                  config={chart_config}
                  className="aspect-auto h-[240px] w-full"
                >
                  <BarChart
                    accessibilityLayer
                    data={chart_data}
                    margin={{ top: 20, left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={24}
                      tickFormatter={formatChartDate}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dashed"
                          labelFormatter={formatChartDate}
                        />
                      }
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--color-total)"
                      radius={8}
                    >
                      <LabelList
                        position="top"
                        offset={12}
                        className="fill-foreground"
                        fontSize={12}
                        formatter={formatNumber}
                      />
                    </Bar>
                    <Bar
                      dataKey="total_point"
                      fill="var(--color-total_point)"
                      radius={8}
                    >
                      <LabelList
                        position="top"
                        offset={12}
                        className="fill-foreground"
                        fontSize={12}
                        formatter={formatNumber}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            ) : null}
            {table_rows.length ? (
              <div>
                <div className="max-h-[420px] overflow-auto rounded-lg border [&>[data-slot=table-container]]:overflow-visible">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>
                          <button
                            type="button"
                            onClick={() => toggleSort("nama_outlet")}
                            className="flex items-center gap-2 font-medium"
                          >
                            Outlet
                            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort("total")}
                            className="ml-auto flex items-center gap-2 font-medium"
                          >
                            Total
                            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right">
                          <button
                            type="button"
                            onClick={() => toggleSort("total_point")}
                            className="ml-auto flex items-center gap-2 font-medium"
                          >
                            Total Poin
                            <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible_rows.map((item) => (
                        <TableRow key={item.uuid_outlet}>
                          <TableCell className="font-medium">
                            {item.nama_outlet}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(item.total_point)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
                {view_state === "loading"
                  ? "Memuat data kepatuhan SOP CCTV..."
                  : view_state === "error"
                    ? "Gagal memuat data kepatuhan SOP CCTV."
                    : "Data kepatuhan SOP CCTV belum tersedia."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
