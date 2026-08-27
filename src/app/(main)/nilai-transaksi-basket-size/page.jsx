"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRangeIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import OptionDropdown from "@/components/option-dropdown";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import BasketSizeTab from "./components/basket-size-tab";
import ImportDataModal from "./components/import-data-modal";
import MetricBulkActionModal from "./components/metric-bulk-action-modal";
import NilaiTransaksiDailyEditModal from "./components/nilai-transaksi-daily-edit-modal";
import { outlet_category_slug_options } from "@/lib/outletCategories";
import NilaiTransaksiTab from "./components/nilai-transaksi-tab";

const empty_metrics = {
  nt_target: 0,
  nt_daily: 0,
  nt_last_month: 0,
  nt_current_month: 0,
  nt_growth: 0,
  nt_gap_growth: -100,
  nt_target_compare: 0,
  nt_gap_target: -100,
  bs_target: 0,
  bs_last_month: 0,
  bs_current_month: 0,
  bs_growth: 0,
  bs_gap_growth: -100,
  bs_target_compare: 0,
  bs_gap_target: -100,
};

const default_table_labels = {
  selected_date_label: "",
  selected_month_label: "",
  selected_period_label: "",
  previous_month_label: "",
  previous_period_label: "",
};

const default_available_dates = {
  nilai_transaksi: [],
  basket_size: [],
};

function resolveMetricEndpoint(metric) {
  return metric === "basket-size" ? "/api/basket-size" : "/api/nilai-transaksi";
}

async function fetchMetricData(date, metric) {
  const response = await fetch(
    `${resolveMetricEndpoint(metric)}?selected_date=${encodeURIComponent(date)}`,
    { cache: "no-store" },
  );
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Gagal mengambil data nilai transaksi.");
  }

  return payload.data;
}

export default function NilaiTransaksiPage() {
  const { role } = useAuth();
  const [activeMetric, setActiveMetric] = useState("nilai-transaksi");
  const [selectedDate, setSelectedDate] = useState("2026-08-25");
  const [selectedOutletFilter, setSelectedOutletFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("non-pariwisata");
  const [rows, setRows] = useState([]);
  const [categoryMetrics, setCategoryMetrics] = useState({});
  const [tableLabels, setTableLabels] = useState(default_table_labels);
  const [availableDates, setAvailableDates] = useState(default_available_dates);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const canImport = role === "admin" || role === "superadmin";
  const activeMetricLabel =
    activeMetric === "nilai-transaksi" ? "Nilai Transaksi" : "Basket Size";

  useEffect(() => {
    let shouldIgnore = false;

    async function loadMetrics() {
      try {
        setIsLoading(true);
        const metrics = await fetchMetricData(selectedDate, activeMetric);

        if (shouldIgnore) {
          return;
        }

        setRows(metrics.rows ?? []);
        setCategoryMetrics(metrics.category_metrics ?? {});
        setTableLabels({
          selected_date_label: metrics.selected_date_label ?? "",
          selected_month_label: metrics.selected_month_label ?? "",
          selected_period_label: metrics.selected_period_label ?? "",
          previous_month_label: metrics.previous_month_label ?? "",
          previous_period_label: metrics.previous_period_label ?? "",
        });
        setAvailableDates(metrics.available_dates ?? default_available_dates);
      } catch (error) {
        if (!shouldIgnore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data nilai transaksi.",
          );
        }
      } finally {
        if (!shouldIgnore) {
          setIsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      shouldIgnore = true;
    };
  }, [activeMetric, selectedDate]);

  const outlet_filter_options = useMemo(
    () => [
      { value: "all", label: "Semua Outlet" },
      ...rows.map((row) => ({
        value: row.uuid,
        label: row.outlet_name,
      })),
    ],
    [rows],
  );

  const filtered_outlet_rows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.category_key === selectedCategory &&
          (selectedOutletFilter === "all" || row.uuid === selectedOutletFilter),
      ),
    [rows, selectedCategory, selectedOutletFilter],
  );
  const displayed_metrics =
    (selectedOutletFilter === "all"
      ? categoryMetrics[selectedCategory]
      : filtered_outlet_rows[0]) ?? empty_metrics;

  const onImportButtonClick = () => {
    setIsImportModalOpen(true);
  };

  const refreshMetrics = async () => {
    const metrics = await fetchMetricData(selectedDate, activeMetric);

    setRows(metrics.rows ?? []);
    setCategoryMetrics(metrics.category_metrics ?? {});
    setTableLabels({
      selected_date_label: metrics.selected_date_label ?? "",
      selected_month_label: metrics.selected_month_label ?? "",
      selected_period_label: metrics.selected_period_label ?? "",
      previous_month_label: metrics.previous_month_label ?? "",
      previous_period_label: metrics.previous_period_label ?? "",
    });
    setAvailableDates(metrics.available_dates ?? default_available_dates);
  };

  const onImportSubmit = async ({ import_date, file, import_type }) => {
    try {
      if (!canImport) {
        throw new Error("Hanya admin yang dapat mengimpor file Excel.");
      }

      if (!import_date || !file || !import_type) {
        throw new Error("Tanggal data dan file Excel wajib diisi.");
      }

      setIsImporting(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("import_date", import_date);

      const import_endpoint = resolveMetricEndpoint(import_type);
      const response = await fetch(import_endpoint, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal mengimpor file Excel.");
      }

      if (selectedDate === import_date) {
        const metrics = await fetchMetricData(import_date, import_type);
        setRows(metrics.rows ?? []);
        setCategoryMetrics(metrics.category_metrics ?? {});
        setTableLabels({
          selected_date_label: metrics.selected_date_label ?? "",
          selected_month_label: metrics.selected_month_label ?? "",
          selected_period_label: metrics.selected_period_label ?? "",
          previous_month_label: metrics.previous_month_label ?? "",
          previous_period_label: metrics.previous_period_label ?? "",
        });
        setAvailableDates(metrics.available_dates ?? default_available_dates);
      } else {
        setSelectedDate(import_date);
        setSelectedOutletFilter("all");
      }

      setIsImportModalOpen(false);
      toast.success(payload.message || "File Excel berhasil diimpor.");

      if (Array.isArray(payload.data?.unmatched_outlets) && payload.data.unmatched_outlets.length) {
        toast.warning(
          `${payload.data.unmatched_outlets.length} outlet tidak cocok dengan master outlet.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengimpor file Excel.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleDailyEdit = async ({ daily }) => {
    if (!editingRow) {
      return;
    }

    try {
      setIsMutating(true);
      const response = await fetch("/api/nilai-transaksi", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_daily",
          uuid_outlet: editingRow.uuid,
          selected_date: selectedDate,
          daily,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui nilai harian.");
      }

      await refreshMetrics();
      setEditingRow(null);
      toast.success(payload.message || "Nilai harian berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui nilai harian.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSingleDelete = async () => {
    if (!deletingItem) {
      return;
    }

    try {
      setIsMutating(true);
      const response = await fetch(resolveMetricEndpoint(deletingItem.metric), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete_daily",
          uuid_outlet: deletingItem.row.uuid,
          selected_date: selectedDate,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus data outlet.");
      }

      await refreshMetrics();
      setDeletingItem(null);
      toast.success(payload.message || "Data outlet berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus data outlet.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleBulkAction = async ({ source_date, target_date }) => {
    if (!bulkAction) {
      return;
    }

    try {
      setIsMutating(true);
      const is_edit = bulkAction.action === "edit_date";
      const response = await fetch(resolveMetricEndpoint(bulkAction.metric), {
        method: is_edit ? "PATCH" : "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          is_edit
            ? {
                action: "bulk_update_date",
                source_date,
                target_date,
              }
            : {
                action: "bulk_delete_date",
                selected_date: source_date,
              },
        ),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ||
            (is_edit
              ? "Gagal memperbarui tanggal secara massal."
              : "Gagal menghapus data secara massal."),
        );
      }

      setBulkAction(null);

      if (is_edit && selectedDate === source_date) {
        setSelectedDate(target_date);
      } else {
        await refreshMetrics();
      }

      toast.success(payload.message || "Perubahan massal berhasil disimpan.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Perubahan massal gagal.",
      );
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Nilai Transaksi & Basket Size"
          description="Pantau nilai transaksi, basket size, pertumbuhan outlet, dan pencapaian target berdasarkan periode berjalan."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={activeMetric} onValueChange={setActiveMetric} className="w-full">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex min-w-0 flex-col gap-2 sm:w-[220px]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Kategori
                  </span>
                  <OptionDropdown
                    id={`filter-kategori-${activeMetric}`}
                    value={selectedCategory}
                    options={outlet_category_slug_options}
                    onValueChange={setSelectedCategory}
                    ariaLabel="Filter kategori outlet"
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:w-[320px]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Outlet
                  </span>
                  <OptionDropdown
                    id="filter-outlet-nilai-transaksi"
                    value={selectedOutletFilter}
                    options={outlet_filter_options}
                    onValueChange={setSelectedOutletFilter}
                    ariaLabel="Filter outlet nilai transaksi"
                    searchable
                    searchPlaceholder="Cari outlet..."
                    emptyMessage="Outlet tidak ditemukan."
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:w-[180px]">
                  <span className="text-xs font-medium text-muted-foreground">
                    Tanggal
                  </span>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedOutletFilter("all");
                    }}
                    className="bg-card"
                    aria-label="Tanggal nilai transaksi"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  disabled
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <FileSpreadsheetIcon className="size-4" />
                  Export
                </Button>
              </div>
            </div>

            <TabsList className="w-full">
              <TabsTrigger value="nilai-transaksi" className="flex-1 px-4">
                Nilai Transaksi
              </TabsTrigger>
              <TabsTrigger value="basket-size" className="flex-1 px-4">
                Basket Size
              </TabsTrigger>
            </TabsList>

            <Card className="gap-0 border-t-4 border-t-primary">
              <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>
                  {activeMetricLabel}
                </CardTitle>
                <Button
                  type="button"
                  disabled={isImporting || !canImport}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                  onClick={onImportButtonClick}
                >
                  {isImporting ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Mengimpor...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheetIcon className="size-4" />
                      Impor
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {canImport ? (
                  <div className="mb-4 flex flex-wrap justify-end gap-2">
                    {activeMetric === "nilai-transaksi" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setBulkAction({
                            action: "edit_date",
                            metric: "nilai-transaksi",
                          })
                        }
                      >
                        <CalendarRangeIcon className="size-4" />
                        Edit Massal
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="delete"
                      onClick={() =>
                        setBulkAction({
                          action: "delete_date",
                          metric: activeMetric,
                        })
                      }
                    >
                      <Trash2Icon className="size-4" />
                      Hapus Massal
                    </Button>
                  </div>
                ) : null}
                {isLoading ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
                    Memuat data...
                  </div>
                ) : activeMetric === "nilai-transaksi" ? (
                  <NilaiTransaksiTab
                    category_metrics={displayed_metrics}
                    labels={tableLabels}
                    rows={filtered_outlet_rows}
                    can_manage={canImport}
                    on_edit={(row) => setEditingRow(row)}
                    on_delete={(row) =>
                      setDeletingItem({ row, metric: "nilai-transaksi" })
                    }
                  />
                ) : (
                  <BasketSizeTab
                    category_metrics={displayed_metrics}
                    labels={tableLabels}
                    rows={filtered_outlet_rows}
                    can_manage={canImport}
                    on_delete={(row) =>
                      setDeletingItem({ row, metric: "basket-size" })
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </div>

      {isImportModalOpen ? (
        <ImportDataModal
          default_date={selectedDate}
          import_type={activeMetric}
          is_importing={isImporting}
          on_open_change={setIsImportModalOpen}
          on_submit={onImportSubmit}
        />
      ) : null}

      {editingRow ? (
        <NilaiTransaksiDailyEditModal
          open
          row={editingRow}
          selected_date={selectedDate}
          is_saving={isMutating}
          on_open_change={(open) => {
            if (!open) {
              setEditingRow(null);
            }
          }}
          on_submit={handleDailyEdit}
        />
      ) : null}

      <ConfirmActionDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
        title={`Hapus ${deletingItem?.metric === "basket-size" ? "Basket Size" : "Nilai Transaksi"}`}
        description={`Data ${deletingItem?.row?.outlet_name ?? "outlet"} pada ${selectedDate} akan dihapus.`}
        confirmLabel="Ya, hapus"
        confirmVariant="delete"
        onConfirm={handleSingleDelete}
        isPending={isMutating}
      />

      {bulkAction ? (
        <MetricBulkActionModal
          open
          action={bulkAction.action}
          metric_label={
            bulkAction.metric === "basket-size" ? "basket size" : "nilai transaksi"
          }
          dates={
            bulkAction.metric === "basket-size"
              ? availableDates.basket_size
              : availableDates.nilai_transaksi
          }
          default_date={selectedDate}
          is_processing={isMutating}
          on_open_change={(open) => {
            if (!open) {
              setBulkAction(null);
            }
          }}
          on_submit={handleBulkAction}
        />
      ) : null}
    </>
  );
}
