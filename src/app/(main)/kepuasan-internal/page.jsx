"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, Loader2Icon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";
import {
  clear_kepuasan_internal_cache,
  get_kepuasan_internal_from_db,
} from "@/lib/kepuasanInternalClient";
import PageHeading from "@/components/page-heading";
import ChartBarMultiple from "@/components/charts/chart-bar-multiple";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const getFallbackYear = () => String(new Date().getFullYear());

const getYearOptions = (chart_data) => {
  const labels = Array.isArray(chart_data?.labels) ? chart_data.labels : [];
  const years = Array.from(new Set(labels.map((label) => label.slice(0, 4))));

  return years.length ? years.sort().reverse() : [getFallbackYear()];
};

const filterDataByYear = (chart_data, selectedYear) => {
  if (!chart_data?.chart_data?.length || !chart_data?.series?.length) {
    return null;
  }

  return {
    ...chart_data,
    chart_data: chart_data.chart_data.filter((item) =>
      item.month.startsWith(`${selectedYear}-`),
    ),
  };
};

const getRespondentStat = (chart_data) => {
  const latest_month = chart_data?.chart_data?.at(-1);
  const series = chart_data?.series ?? [];

  if (!latest_month || !series.length) {
    return null;
  }

  const total = series.reduce(
    (sum, item) => sum + (Number(latest_month[item.key]) || 0),
    0,
  );

  return {
    value: total.toLocaleString("id-ID"),
    label: "InsanKu mengisi bulan ini.",
  };
};

export default function KepuasanInternalPage() {
  const [chart_data, setChartData] = useState(null);
  const [error_message, setErrorMessage] = useState("");
  const [is_loading, setIsLoading] = useState(true);
  const [sync_status, setSyncStatus] = useState("idle");
  const [selectedYear, setSelectedYear] = useState(getFallbackYear());

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        const response_data = await get_kepuasan_internal_from_db({
          year: selectedYear,
        });

        if (!is_active) {
          return;
        }

        if (!response_data.success) {
          setChartData(null);
          setErrorMessage(response_data.message);
          return;
        }

        setChartData(response_data.data);
        setErrorMessage("");

        const next_year_options = getYearOptions(response_data.data);
        if (!next_year_options.includes(selectedYear)) {
          setSelectedYear(next_year_options[0]);
        }
      } catch (error) {
        if (!is_active) {
          return;
        }

        setChartData(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil data.",
        );
      } finally {
        if (is_active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      is_active = false;
    };
  }, [selectedYear]);

  const year_options = useMemo(() => getYearOptions(chart_data), [chart_data]);
  const filtered_data = useMemo(
    () => filterDataByYear(chart_data, selectedYear),
    [chart_data, selectedYear],
  );
  const respondent_stat = useMemo(
    () => getRespondentStat(filtered_data),
    [filtered_data],
  );

  const syncKepuasanInternalHandler = async () => {
    try {
      setSyncStatus("loading");
      setIsLoading(true);

      const response = await fetch("/api/kepuasan-internal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
        }),
      });
      const payload = await response.json();
      const response_data = {
        success: response.ok && payload.success,
        status: response.status,
        message: payload.message || "Sinkronisasi kepuasan internal gagal dijalankan.",
        data: payload.data,
      };

      if (!response_data.success) {
        throw new Error(response_data.message);
      }

      clear_kepuasan_internal_cache();
      const latest_response = await get_kepuasan_internal_from_db({
        year: selectedYear,
      });

      if (!latest_response.success) {
        setChartData(null);
        setErrorMessage(latest_response.message);
        return;
      }

      setChartData(latest_response.data);
      setErrorMessage("");
      toast.success(
        response_data.message || "Sinkronisasi kepuasan internal berhasil.",
      );
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
          title="Kepuasan Internal"
          description="Pantau tren jawaban puas dan tidak puas dari monthly review."
          action={
            respondent_stat ? (
              <div className="flex min-w-44 items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-primary">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <UsersRoundIcon className="size-4" />
                </div>
                <div>
                  <div className="text-lg font-semibold leading-none">
                    {respondent_stat.value}
                  </div>
                  <div className="mt-1 text-xs font-medium leading-tight">
                    {respondent_stat.label}
                  </div>
                </div>
              </div>
            ) : null
          }
        />
      </div>
      <div className="space-y-4 px-4 lg:px-6">
        <ChartBarMultiple
          title="Tren Bulanan"
          filter={
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <span className="text-xs font-medium text-muted-foreground">
                Tahun
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between bg-card sm:w-[170px]"
                    />
                  }
                >
                  <span>{selectedYear}</span>
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px]">
                  <DropdownMenuRadioGroup
                    value={selectedYear}
                    onValueChange={(year) => {
                      setIsLoading(true);
                      setSelectedYear(year);
                    }}
                  >
                    {year_options.map((year) => (
                      <DropdownMenuRadioItem
                        key={year}
                        value={year}
                        className="py-2 text-sm"
                      >
                        {year}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
          action={
            <Button
              type="button"
              onClick={syncKepuasanInternalHandler}
              disabled={sync_status === "loading"}
              className="w-full sm:w-auto"
            >
              {sync_status === "loading" ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Menyinkronkan...
                </>
              ) : (
                "Sinkron"
              )}
            </Button>
          }
          chartData={filtered_data?.chart_data ?? []}
          series={filtered_data?.series ?? chart_data?.series ?? []}
          emptyMessage={
            is_loading
              ? "Memuat data kepuasan internal..."
              : error_message || "Belum ada data kepuasan internal."
          }
        />
      </div>
    </>
  );
}
