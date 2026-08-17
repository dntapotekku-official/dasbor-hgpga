"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import PageHeading from "@/components/page-heading";
import ChartBarMultiple from "./components/chart-bar-multiple";
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

const filterDataByYear = (chart_data, selected_year) => {
  if (!chart_data?.chart_data?.length || !chart_data?.series?.length) {
    return null;
  }

  return {
    ...chart_data,
    chart_data: chart_data.chart_data.filter((item) =>
      item.month.startsWith(`${selected_year}-`),
    ),
  };
};

export default function KepuasanInternalPage() {
  const [chart_data, setChartData] = useState(null);
  const [error_message, setErrorMessage] = useState("");
  const [is_loading, setIsLoading] = useState(true);
  const [sync_status, setSyncStatus] = useState("idle");
  const [selected_year, setSelectedYear] = useState(getFallbackYear());

  const fetchKepuasanInternal = async (year) => {
    const search_params = new URLSearchParams();

    if (year) {
      search_params.set("year", year);
    }

    const query = search_params.toString();
    const response = await fetch(`/api/kepuasan-internal${query ? `?${query}` : ""}`);
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      return {
        success: false,
        message: payload.message || "Data kepuasan internal belum tersedia.",
        data: null,
      };
    }

    return {
      success: true,
      message: "",
      data: payload.data,
    };
  };

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        const response_data = await fetchKepuasanInternal(selected_year);

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
        if (!next_year_options.includes(selected_year)) {
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
  }, [selected_year]);

  const year_options = useMemo(() => getYearOptions(chart_data), [chart_data]);
  const filtered_data = useMemo(
    () => filterDataByYear(chart_data, selected_year),
    [chart_data, selected_year],
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
          tahun: selected_year,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Sinkronisasi gagal dijalankan.");
      }

      toast.success(payload.message || "Sinkronisasi kepuasan internal berhasil.");

      const latest_response = await fetchKepuasanInternal(selected_year);

      if (!latest_response.success) {
        setChartData(null);
        setErrorMessage(latest_response.message);
        return;
      }

      setChartData(latest_response.data);
      setErrorMessage("");
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
                  <span>{selected_year}</span>
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px]">
                  <DropdownMenuRadioGroup
                    value={selected_year}
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
              {sync_status === "loading" ? "Menyinkronkan..." : "Sinkron"}
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
        {!is_loading && error_message ? (
          <p className="text-sm text-destructive">{error_message}</p>
        ) : null}
      </div>
    </>
  );
}
