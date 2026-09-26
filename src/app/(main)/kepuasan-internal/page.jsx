"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import {
  clear_kepuasan_internal_cache,
  get_kepuasan_internal_from_db,
} from "@/lib/kepuasanInternalClient";
import PageHeading from "@/components/page-heading";
import FilterField from "@/components/filter-field";
import ChartBarMultiple from "@/components/charts/chart-bar-multiple";
import SyncActionButton from "@/components/sync-action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function KepuasanInternalPage() {
  const [chart_data, setChartData] = useState(null);
  const [error_message, setErrorMessage] = useState("");
  const [is_loading, setIsLoading] = useState(true);
  const [sync_status, setSyncStatus] = useState("idle");
  const [selected_year, setSelectedYear] = useState(() =>
    String(new Date().getFullYear()),
  );

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        const response_data = await get_kepuasan_internal_from_db({
          year: selected_year,
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

  const year_options = useMemo(() => {
    const current_year = new Date().getFullYear();
    const start_year = 2018;

    return Array.from(
      { length: current_year - start_year + 1 },
      (_, index) => String(current_year - index),
    );
  }, []);
  const filtered_data = useMemo(() => {
    if (!chart_data?.chart_data?.length || !chart_data?.series?.length) {
      return null;
    }

    return {
      ...chart_data,
      chart_data: chart_data.chart_data.filter((item) =>
        item.month.startsWith(`${selected_year}-`),
      ),
    };
  }, [chart_data, selected_year]);
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
          year: selected_year,
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
        year: selected_year,
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
        />
      </div>
      <div className="flex flex-col gap-6 px-4 lg:px-6">
        <ChartBarMultiple
          title="Tren Bulanan"
          filter={
            <FilterField label="Tahun" className="w-full sm:w-auto">
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
            </FilterField>
          }
          action={
            <SyncActionButton
              onConfirm={syncKepuasanInternalHandler}
              description={`Sinkronisasi akan mengambil ulang data kepuasan internal untuk tahun ${selected_year}.`}
              isPending={sync_status === "loading"}
              className="w-full sm:w-auto"
            />
          }
          chartData={filtered_data?.chart_data ?? []}
          series={filtered_data?.series ?? chart_data?.series ?? []}
          xAxisInterval={0}
          labelFormatter={({ value, payload }) => {
            const total_insanku = Number(payload?.total_insanku) || 0;
            const current_value = Number(value) || 0;

            if (!total_insanku) {
              return `${current_value.toLocaleString("id-ID")} (0%)`;
            }

            const percentage = (current_value / total_insanku) * 100;
            const formatted_percentage = percentage.toLocaleString("id-ID", {
              maximumFractionDigits: 1,
            });

            return `${current_value.toLocaleString("id-ID")} (${formatted_percentage}%)`;
          }}
          labelClassName="text-[10px]"
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
