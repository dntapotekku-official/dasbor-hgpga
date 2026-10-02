"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BadgeDollarSignIcon,
  CalendarRangeIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  MinusIcon,
  ShoppingBasketIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import BasketSizeTab from "./components/basket-size-tab";
import {
  formatCurrency,
  formatDecimal,
  formatPeriodRangeLabel,
} from "@/lib/nilaiTransaksiBasketSizeTable";
import {
  comparePercentage,
  comparePercentageRounded,
} from "@/lib/number";
import { outlet_category_slug_options } from "@/lib/outletCategories";
import { hasRoleAccess } from "@/lib/role";
import NilaiTransaksiTab from "./components/nilai-transaksi-tab";

const ImportDataModal = dynamic(() => import("./components/import-data-modal"));
const MetricBulkActionModal = dynamic(
  () => import("./components/metric-bulk-action-modal"),
);
const BasketSizeSkuEditModal = dynamic(
  () => import("./components/basket-size-sku-edit-modal"),
);
const NilaiTransaksiDailyEditModal = dynamic(
  () => import("./components/nilai-transaksi-daily-edit-modal"),
);

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
  nilai_transaksi_bulanan: [],
  basket_size: [],
};

function get_current_date_value() {
  const date_parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part_values = Object.fromEntries(
    date_parts.map((part) => [part.type, part.value]),
  );

  return `${part_values.year}-${part_values.month}-${part_values.day}`;
}

function resolveMetricEndpoint(metric) {
  return metric === "basket-size" ? "/api/basket-size" : "/api/nilai-transaksi";
}

function get_month_start_value(date_value) {
  return `${String(date_value ?? "").slice(0, 8)}01`;
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

function gapValueClassName(value) {
  if (value > 0) {
    return "text-emerald-700 dark:text-emerald-400";
  }

  if (value < 0) {
    return "text-rose-700 dark:text-rose-400";
  }

  return "text-foreground";
}

function GapMetricValue({ value, is_loading = false, large = false }) {
  const DirectionIcon = value > 0
    ? ArrowUpIcon
    : value < 0
      ? ArrowDownIcon
      : MinusIcon;

  return (
    <span
      className={`inline-flex items-center gap-1 ${gapValueClassName(value)}`}
    >
      {is_loading ? (
        "Memuat..."
      ) : (
        <>
          <DirectionIcon className={large ? "size-7" : "size-4"} />
          {formatDecimal(value)}%
        </>
      )}
    </span>
  );
}

function SummaryMetric({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function toNumber(value) {
  const parsed_value = Number(value ?? 0);

  return Number.isFinite(parsed_value) ? parsed_value : 0;
}

function summarizeVisibleRows(rows) {
  if (!rows.length) {
    return empty_metrics;
  }

  const summary = rows.reduce(
    (current, row) => ({
      nt_target: current.nt_target + toNumber(row.nt_target),
      nt_daily_total_revenue:
        current.nt_daily_total_revenue + toNumber(row.nt_daily_total_revenue),
      nt_daily_kunjungan: current.nt_daily_kunjungan + toNumber(row.nt_daily_kunjungan),
      nt_last_month_total_revenue:
        current.nt_last_month_total_revenue + toNumber(row.nt_last_month_total_revenue),
      nt_last_month_kunjungan:
        current.nt_last_month_kunjungan + toNumber(row.nt_last_month_kunjungan),
      nt_current_month_total_revenue:
        current.nt_current_month_total_revenue
        + toNumber(row.nt_current_month_total_revenue),
      nt_current_month_kunjungan:
        current.nt_current_month_kunjungan + toNumber(row.nt_current_month_kunjungan),
      bs_target: current.bs_target + toNumber(row.bs_target),
      bs_current_month_sku_qty:
        current.bs_current_month_sku_qty + toNumber(row.bs_current_month_sku_qty),
      bs_current_month_kunjungan:
        current.bs_current_month_kunjungan + toNumber(row.bs_current_month_kunjungan),
      bs_last_month_sku_qty:
        current.bs_last_month_sku_qty + toNumber(row.bs_last_month_sku_qty),
      bs_last_month_kunjungan:
        current.bs_last_month_kunjungan + toNumber(row.bs_last_month_kunjungan),
    }),
    {
      nt_target: 0,
      nt_daily_total_revenue: 0,
      nt_daily_kunjungan: 0,
      nt_last_month_total_revenue: 0,
      nt_last_month_kunjungan: 0,
      nt_current_month_total_revenue: 0,
      nt_current_month_kunjungan: 0,
      bs_target: 0,
      bs_current_month_sku_qty: 0,
      bs_current_month_kunjungan: 0,
      bs_last_month_sku_qty: 0,
      bs_last_month_kunjungan: 0,
    },
  );
  const row_count = rows.length;
  const nt_daily = summary.nt_daily_kunjungan
    ? summary.nt_daily_total_revenue / summary.nt_daily_kunjungan
    : 0;
  const nt_last_month = summary.nt_last_month_kunjungan
    ? summary.nt_last_month_total_revenue / summary.nt_last_month_kunjungan
    : 0;
  const nt_current_month = summary.nt_current_month_kunjungan
    ? summary.nt_current_month_total_revenue / summary.nt_current_month_kunjungan
    : 0;
  const bs_last_month = summary.bs_last_month_kunjungan
    ? summary.bs_last_month_sku_qty / summary.bs_last_month_kunjungan
    : 0;
  const bs_current_month = summary.bs_current_month_kunjungan
    ? summary.bs_current_month_sku_qty / summary.bs_current_month_kunjungan
    : 0;
  const nt_target = summary.nt_target / row_count;
  const bs_target = summary.bs_target / row_count;
  const nt_growth = comparePercentage(nt_current_month, nt_last_month);
  const bs_growth = comparePercentageRounded(bs_current_month, bs_last_month);
  const nt_target_compare = comparePercentage(nt_current_month, nt_target);
  const bs_target_compare = comparePercentage(bs_current_month, bs_target);

  return {
    ...summary,
    nt_target,
    nt_daily,
    nt_last_month,
    nt_current_month,
    nt_growth,
    nt_gap_growth: nt_growth - 100,
    nt_target_compare,
    nt_gap_target: nt_target_compare - 100,
    bs_target,
    bs_last_month,
    bs_current_month,
    bs_growth,
    bs_gap_growth: bs_growth - 100,
    bs_target_compare,
    bs_gap_target: bs_target_compare - 100,
  };
}

export default function NilaiTransaksiPage() {
  const { role } = useAuth();
  const [activeMetric, setActiveMetric] = useState("nilai-transaksi");
  const [selectedDate, setSelectedDate] = useState(get_current_date_value);
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("non-pariwisata");
  const [rows, setRows] = useState([]);
  const [categoryMetrics, setCategoryMetrics] = useState({});
  const [overallMetrics, setOverallMetrics] = useState(empty_metrics);
  const [tableLabels, setTableLabels] = useState(default_table_labels);
  const [availableDates, setAvailableDates] = useState(default_available_dates);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalType, setImportModalType] = useState("nilai-transaksi");
  const [editingRow, setEditingRow] = useState(null);
  const [editingBasketSizeRow, setEditingBasketSizeRow] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const canManage = hasRoleAccess(role, ["admin"]);
  const canImportExport = canManage;
  const activeMetricLabel =
    activeMetric === "nilai-transaksi" ? "Nilai Transaksi" : "Basket Size";
  const selectedPeriodRangeLabel = formatPeriodRangeLabel(
    tableLabels.selected_period_label,
  );

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
        setOverallMetrics(
          metrics.overall_metrics
            ?? empty_metrics,
        );
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

  const category_outlet_rows = useMemo(
    () =>
      rows
        .filter((row) => row.category_key === selectedCategory)
        .sort((first, second) => {
          const first_value = activeMetric === "nilai-transaksi"
            ? Number(first.nt_gap_growth ?? 0)
            : Number(first.bs_gap_growth ?? 0);
          const second_value = activeMetric === "nilai-transaksi"
            ? Number(second.nt_gap_growth ?? 0)
            : Number(second.bs_gap_growth ?? 0);

          return second_value - first_value
            || first.outlet_name.localeCompare(second.outlet_name, "id-ID");
        }),
    [activeMetric, rows, selectedCategory],
  );
  const outlet_filter_options = useMemo(
    () => [
      { value: "all", label: "Semua outlet" },
      ...category_outlet_rows.map((row) => ({
        value: row.uuid,
        label: row.outlet_name,
      })),
    ],
    [category_outlet_rows],
  );
  const filtered_outlet_rows = useMemo(
    () =>
      selectedOutlet === "all"
        ? category_outlet_rows
        : category_outlet_rows.filter((row) => row.uuid === selectedOutlet),
    [category_outlet_rows, selectedOutlet],
  );
  const highest_category_value = category_outlet_rows.length
    ? Math.max(
      ...category_outlet_rows.map((row) => Number(
        activeMetric === "nilai-transaksi"
          ? row.nt_daily ?? 0
          : row.bs_current_month ?? 0,
      )),
    )
    : null;
  const highest_daily_nilai_transaksi_by_category = useMemo(
    () => outlet_category_slug_options.map((category) => {
      const highest_row = rows
        .filter((row) => row.category_key === category.value)
        .reduce((highest, row) => {
          if (
            !highest
            || Number(row.nt_daily ?? 0) > Number(highest.nt_daily ?? 0)
          ) {
            return row;
          }

          return highest;
        }, null);

      return {
        category_key: category.value,
        category_label: category.label,
        outlet_name: highest_row?.outlet_name ?? "-",
        value: Number(highest_row?.nt_daily ?? 0),
      };
    }),
    [rows],
  );
  const highest_basket_size_by_category = useMemo(
    () => outlet_category_slug_options.map((category) => {
      const highest_row = rows
        .filter((row) => row.category_key === category.value)
        .reduce((highest, row) => {
          if (
            !highest
            || Number(row.bs_current_month ?? 0) >
              Number(highest.bs_current_month ?? 0)
          ) {
            return row;
          }

          return highest;
        }, null);

      return {
        category_key: category.value,
        category_label: category.label,
        outlet_name: highest_row?.outlet_name ?? "-",
        value: Number(highest_row?.bs_current_month ?? 0),
      };
    }),
    [rows],
  );
  const displayed_metrics = selectedOutlet !== "all"
    ? summarizeVisibleRows(filtered_outlet_rows)
    : (categoryMetrics[selectedCategory] ?? empty_metrics);
  const onImportButtonClick = (import_type = activeMetric) => {
    if (!canImportExport) {
      toast.error("Akun outlet tidak memiliki akses impor.");
      return;
    }

    setImportModalType(import_type);
    setIsImportModalOpen(true);
  };

  const onExportButtonClick = async () => {
    if (!canImportExport) {
      toast.error("Akun outlet tidak memiliki akses ekspor.");
      return;
    }

    try {
      setIsExporting(true);
      const response = await fetch(
        `/api/nilai-transaksi?action=export&selected_date=${encodeURIComponent(selectedDate)}`,
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Gagal mengekspor laporan Excel.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1]
        ?? `NILAI-TRANSAKSI-DAN-BASKET-SIZE-${selectedDate}.xlsx`;
      const download_url = URL.createObjectURL(blob);
      const download_link = document.createElement("a");

      download_link.href = download_url;
      download_link.download = filename;
      document.body.appendChild(download_link);
      download_link.click();
      download_link.remove();
      URL.revokeObjectURL(download_url);
      toast.success("Laporan Excel berhasil diekspor.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengekspor laporan Excel.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const refreshMetrics = async () => {
    const metrics = await fetchMetricData(selectedDate, activeMetric);

    setRows(metrics.rows ?? []);
    setCategoryMetrics(metrics.category_metrics ?? {});
    setOverallMetrics(
      metrics.overall_metrics
        ?? empty_metrics,
    );
    setTableLabels({
      selected_date_label: metrics.selected_date_label ?? "",
      selected_month_label: metrics.selected_month_label ?? "",
      selected_period_label: metrics.selected_period_label ?? "",
      previous_month_label: metrics.previous_month_label ?? "",
      previous_period_label: metrics.previous_period_label ?? "",
    });
    setAvailableDates(metrics.available_dates ?? default_available_dates);
  };

  const onImportSubmit = async ({
    import_date,
    import_from_date,
    file,
    import_type,
  }) => {
    try {
      if (!canImportExport) {
        throw new Error("Akun tidak memiliki akses untuk mengimpor file Excel.");
      }

      const uses_file_dates = import_type === "basket-size";

      if (
        !file
        || !import_type
        || (!uses_file_dates && !import_date)
        || (import_type === "nilai-transaksi" && !import_from_date)
      ) {
        throw new Error(
          uses_file_dates
            ? "File Excel wajib dipilih."
            : import_type === "nilai-transaksi"
            ? "Tanggal dari, tanggal sampai, dan file Excel wajib diisi."
            : "Tanggal data dan file Excel wajib diisi.",
        );
      }

      setIsImporting(true);

      const formData = new FormData();
      formData.append("file", file);

      if (!uses_file_dates) {
        formData.append("import_date", import_date);
      }

      if (import_type === "nilai-transaksi") {
        formData.append("from_date", import_from_date);
      }

      const import_endpoint = resolveMetricEndpoint(import_type);
      const response = await fetch(import_endpoint, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal mengimpor file Excel.");
      }

      const result_date = payload.data?.import_date ?? import_date;

      if (selectedDate === result_date) {
        const metrics = await fetchMetricData(result_date, activeMetric);
        setRows(metrics.rows ?? []);
        setCategoryMetrics(metrics.category_metrics ?? {});
        setOverallMetrics(
          metrics.overall_metrics
            ?? empty_metrics,
        );
        setTableLabels({
          selected_date_label: metrics.selected_date_label ?? "",
          selected_month_label: metrics.selected_month_label ?? "",
          selected_period_label: metrics.selected_period_label ?? "",
          previous_month_label: metrics.previous_month_label ?? "",
          previous_period_label: metrics.previous_period_label ?? "",
        });
        setAvailableDates(metrics.available_dates ?? default_available_dates);
      } else {
        setSelectedDate(result_date);
        setSelectedOutlet("all");
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

  const handleNilaiTransaksiEdit = async ({
    total_revenue_daily,
    total_revenue_monthly,
  }) => {
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
          action: "update_totals",
          uuid_outlet: editingRow.uuid,
          selected_date: selectedDate,
          total_revenue_daily,
          total_revenue_monthly,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui nilai harian.");
      }

      await refreshMetrics();
      setEditingRow(null);
      toast.success(payload.message || "Nilai transaksi berhasil diperbarui.");
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

  const handleBasketSizeSkuEdit = async ({ sku_qty }) => {
    if (!editingBasketSizeRow) {
      return;
    }

    try {
      setIsMutating(true);
      const response = await fetch("/api/basket-size", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_sku_qty",
          uuid_outlet: editingBasketSizeRow.uuid,
          selected_date: selectedDate,
          sku_qty,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui jumlah SKU.");
      }

      await refreshMetrics();
      setEditingBasketSizeRow(null);
      toast.success(payload.message || "Jumlah SKU basket size berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui jumlah SKU.",
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
          ...(deletingItem.metric === "basket-size"
            ? {
                from_date: get_month_start_value(selectedDate),
                to_date: selectedDate,
              }
            : {
                selected_date: selectedDate,
              }),
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

  const handleBulkAction = async ({
    source_date,
    target_date,
    source_from_date,
    source_to_date,
    target_from_date,
    target_to_date,
  }) => {
    if (!bulkAction) {
      return;
    }

    try {
      setIsMutating(true);
      const is_edit = bulkAction.action === "edit_date";
      const is_monthly = bulkAction.period === "monthly";
      const response = await fetch(resolveMetricEndpoint(bulkAction.metric), {
        method: is_edit ? "PATCH" : "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          is_edit
            ? {
                action: is_monthly ? "bulk_update_monthly" : "bulk_update_date",
                ...(is_monthly
                  ? {
                      source_from_date,
                      source_to_date,
                      target_from_date,
                      target_to_date,
                    }
                  : {
                      source_date,
                      target_date,
                    }),
              }
            : {
                action: is_monthly ? "bulk_delete_monthly" : "bulk_delete_date",
                ...(is_monthly
                  ? {
                      from_date: source_from_date,
                      to_date: source_to_date,
                    }
                  : {
                      selected_date: source_date,
                    }),
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

      if (!is_monthly && is_edit && selectedDate === source_date) {
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
          description={
            canManage
              ? "Pantau nilai transaksi, basket size, pertumbuhan outlet, dan pencapaian target berdasarkan periode berjalan."
              : "Lihat nilai transaksi, basket size, dan pencapaian target untuk outlet Anda."
          }
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={activeMetric} onValueChange={setActiveMetric} className="w-full">
          <div className="flex flex-col gap-6">
            {activeMetric === "nilai-transaksi" ? (
              <Card className="bg-orange-50/60 dark:bg-orange-950/15">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50">
                      <BadgeDollarSignIcon className="size-5 text-orange-700 dark:text-orange-300" />
                    </div>
                    <div className="grid min-w-0 auto-rows-min gap-1 text-left">
                      <CardTitle>Nilai Transaksi</CardTitle>
                      <CardDescription>
                        Semua kategori • {tableLabels.selected_date_label || "tanggal terpilih"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Gap Growth</p>
                      <p className="text-3xl font-semibold tracking-tight">
                        <GapMetricValue
                          value={overallMetrics.nt_gap_growth}
                          is_loading={isLoading}
                          large
                        />
                      </p>
                    </div>
                    <div className="min-w-0 space-y-1 border-l pl-4">
                      <p className="text-xs font-medium text-muted-foreground">Gap Target</p>
                      <p className="text-3xl font-semibold tracking-tight">
                        <GapMetricValue
                          value={overallMetrics.nt_gap_target}
                          is_loading={isLoading}
                          large
                        />
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 xl:grid-cols-3">
                    <SummaryMetric
                      label="Target"
                      value={formatCurrency(overallMetrics.nt_target)}
                    />
                    <SummaryMetric
                      label="Total Penerimaan Pendapatan (Harian)"
                      value={formatCurrency(overallMetrics.nt_daily_total_revenue)}
                    />
                    <SummaryMetric
                      label="Kunjungan (Harian)"
                      value={formatDecimal(overallMetrics.nt_daily_kunjungan, 0)}
                    />
                    <SummaryMetric
                      label={`Total Penerimaan Pendapatan ${selectedPeriodRangeLabel || "(periode ini)"}`}
                      value={formatCurrency(overallMetrics.nt_current_month_total_revenue)}
                    />
                    <SummaryMetric
                      label={`Kunjungan ${selectedPeriodRangeLabel || "(periode berjalan)"}`}
                      value={formatDecimal(overallMetrics.nt_current_month_kunjungan, 0)}
                    />
                    <SummaryMetric
                      label={`Harian (${tableLabels.selected_date_label || "tanggal terpilih"})`}
                      value={formatCurrency(overallMetrics.nt_daily)}
                    />
                    <SummaryMetric
                      label={tableLabels.selected_period_label || "Periode berjalan"}
                      value={formatCurrency(overallMetrics.nt_current_month)}
                    />
                    <SummaryMetric
                      label={tableLabels.previous_period_label || "Periode sebelumnya"}
                      value={formatCurrency(overallMetrics.nt_last_month)}
                    />
                    <SummaryMetric
                      label="Growth"
                      value={`${formatDecimal(overallMetrics.nt_growth)}%`}
                    />
                    <SummaryMetric
                      label="% Dibanding Target"
                      value={`${formatDecimal(overallMetrics.nt_target_compare)}%`}
                    />
                  </div>
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      Nilai Transaksi Harian Tertinggi per Kategori
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {highest_daily_nilai_transaksi_by_category.map((item) => (
                        <div
                          key={item.category_key}
                          className="min-w-0 rounded-md bg-white/70 px-3 py-2 dark:bg-white/5"
                        >
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            {item.category_label}
                          </p>
                          <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                            <span className="truncate font-medium text-emerald-950 dark:text-emerald-100">
                              {item.outlet_name}
                            </span>
                            <span className="shrink-0 font-semibold text-emerald-950 dark:text-emerald-100">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-blue-50/60 dark:bg-blue-950/15">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50">
                      <ShoppingBasketIcon className="size-5 text-blue-700 dark:text-blue-300" />
                    </div>
                    <div className="grid min-w-0 auto-rows-min gap-1 text-left">
                      <CardTitle>Basket Size</CardTitle>
                      <CardDescription>
                        Semua kategori • {tableLabels.selected_date_label || "tanggal terpilih"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Gap Growth</p>
                      <p className="text-3xl font-semibold tracking-tight">
                        <GapMetricValue
                          value={overallMetrics.bs_gap_growth}
                          is_loading={isLoading}
                          large
                        />
                      </p>
                    </div>
                    <div className="min-w-0 space-y-1 border-l pl-4">
                      <p className="text-xs font-medium text-muted-foreground">Gap Target</p>
                      <p className="text-3xl font-semibold tracking-tight">
                        <GapMetricValue
                          value={overallMetrics.bs_gap_target}
                          is_loading={isLoading}
                          large
                        />
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 xl:grid-cols-3">
                    <SummaryMetric
                      label="Target"
                      value={formatDecimal(overallMetrics.bs_target)}
                    />
                    <SummaryMetric
                      label="Jumlah SKU"
                      value={formatDecimal(overallMetrics.bs_current_month_sku_qty, 0)}
                    />
                    <SummaryMetric
                      label="Kunjungan"
                      value={formatDecimal(overallMetrics.bs_current_month_kunjungan, 0)}
                    />
                    <SummaryMetric
                      label={tableLabels.previous_period_label || "Periode sebelumnya"}
                      value={formatDecimal(overallMetrics.bs_last_month)}
                    />
                    <SummaryMetric
                      label={tableLabels.selected_period_label || "Periode berjalan"}
                      value={formatDecimal(overallMetrics.bs_current_month)}
                    />
                    <SummaryMetric
                      label="Growth"
                      value={`${formatDecimal(overallMetrics.bs_growth)}%`}
                    />
                    <SummaryMetric
                      label="% Dibanding Target"
                      value={`${formatDecimal(overallMetrics.bs_target_compare)}%`}
                    />
                  </div>
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-900 dark:bg-blue-950/30">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Basket Size Tertinggi per Kategori
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      {highest_basket_size_by_category.map((item) => (
                        <div
                          key={item.category_key}
                          className="min-w-0 rounded-md bg-white/70 px-3 py-2 dark:bg-white/5"
                        >
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {item.category_label}
                          </p>
                          <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                            <span className="truncate font-medium text-blue-950 dark:text-blue-100">
                              {item.outlet_name}
                            </span>
                            <span className="shrink-0 font-semibold text-blue-950 dark:text-blue-100">
                              {formatDecimal(item.value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <FilterField
                  label="Kategori"
                  htmlFor={`filter-kategori-${activeMetric}`}
                  className="sm:w-[220px]"
                >
                  <OptionDropdown
                    id={`filter-kategori-${activeMetric}`}
                    value={selectedCategory}
                    options={outlet_category_slug_options}
                    onValueChange={(next_category) => {
                      setSelectedCategory(next_category);
                      setSelectedOutlet("all");
                    }}
                    ariaLabel="Filter kategori outlet"
                  />
                </FilterField>

                <FilterField label="Outlet" className="sm:w-[320px]">
                  <OptionDropdown
                    value={selectedOutlet}
                    onValueChange={setSelectedOutlet}
                    options={outlet_filter_options}
                    searchable
                    ariaLabel="Filter outlet"
                    searchPlaceholder="Cari outlet..."
                    emptySearchMessage="Outlet tidak ditemukan."
                  />
                </FilterField>

                <FilterField label="Tanggal" className="sm:w-[180px]">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedOutlet("all");
                    }}
                    className="bg-card"
                    aria-label="Tanggal nilai transaksi"
                  />
                </FilterField>
              </div>

              {canImportExport ? (
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={onExportButtonClick}
                  >
                    <FileSpreadsheetIcon className="size-4" />
                    {isExporting ? "Mengekspor..." : "Ekspor"}
                  </Button>
                </div>
              ) : null}
            </div>

            <TabsList className="w-full">
              <TabsTrigger value="nilai-transaksi" className="flex-1 px-4">
                Nilai Transaksi
              </TabsTrigger>
              <TabsTrigger value="basket-size" className="flex-1 px-4">
                Basket Size
              </TabsTrigger>
            </TabsList>

            <Card className="gap-0 border-t-2 border-t-primary/70">
              <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>
                  {activeMetricLabel}
                </CardTitle>
                {canImportExport ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {activeMetric === "nilai-transaksi" ? (
                      <Button
                        type="button"
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                        onClick={() => onImportButtonClick("nilai-transaksi")}
                        disabled={isImporting}
                        aria-busy={isImporting}
                      >
                        {isImporting && importModalType === "nilai-transaksi" ? (
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
                    ) : (
                      <Button
                        type="button"
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                        onClick={() => onImportButtonClick("basket-size")}
                        disabled={isImporting}
                        aria-busy={isImporting}
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
                    )}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {canManage ? (
                  <div className="mb-6 flex flex-wrap justify-end gap-2">
                    {activeMetric === "nilai-transaksi" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setBulkAction({
                            action: "edit_date",
                            metric: "nilai-transaksi",
                            period: "monthly",
                          })
                        }
                      >
                        <CalendarRangeIcon className="size-4" />
                        Edit Massal (Rentang)
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="delete"
                      onClick={() =>
                        setBulkAction({
                          action: "delete_date",
                          metric: activeMetric,
                          period: activeMetric === "nilai-transaksi" || activeMetric === "basket-size" ? "monthly" : "daily",
                        })
                      }
                    >
                      <Trash2Icon className="size-4" />
                      {activeMetric === "nilai-transaksi" || activeMetric === "basket-size"
                        ? "Hapus Massal (Rentang)"
                        : "Hapus Massal (Harian)"}
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
                    highest_daily={highest_category_value}
                    labels={tableLabels}
                    rows={filtered_outlet_rows}
                    can_manage={canManage}
                    on_edit={(row) => setEditingRow(row)}
                    on_delete={(row) =>
                      setDeletingItem({ row, metric: "nilai-transaksi" })
                    }
                  />
                ) : (
                  <BasketSizeTab
                    category_metrics={displayed_metrics}
                    highest_achievement={highest_category_value}
                    labels={tableLabels}
                    rows={filtered_outlet_rows}
                    can_manage={canManage}
                    on_edit={(row) => setEditingBasketSizeRow(row)}
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

      {canImportExport && isImportModalOpen ? (
        <ImportDataModal
          default_date={selectedDate}
          import_type={importModalType}
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
          on_submit={handleNilaiTransaksiEdit}
        />
      ) : null}

      {editingBasketSizeRow ? (
        <BasketSizeSkuEditModal
          open
          row={editingBasketSizeRow}
          selected_date={selectedPeriodRangeLabel || selectedDate}
          is_saving={isMutating}
          on_open_change={(open) => {
            if (!open) {
              setEditingBasketSizeRow(null);
            }
          }}
          on_submit={handleBasketSizeSkuEdit}
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
          period={bulkAction.period ?? "daily"}
          dates={
            bulkAction.metric === "basket-size"
              ? availableDates.basket_size
            : bulkAction.period === "monthly"
              ? availableDates.nilai_transaksi_bulanan
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
