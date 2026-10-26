import {
  formatDecimal,
  formatPeriodRangeLabel,
  formatPercentage,
  gapClassName,
} from "@/lib/nilaiTransaksiBasketSizeTable";
import CurrencyValue from "@/components/currency-value";
import { summaryExclusionLabel } from "@/lib/ntBsSummaryExclusion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

function sticky_identity_class(column, highlight_nt_decline = false) {
  return column === "number"
    ? "w-24 min-w-24 max-w-24 bg-background md:sticky md:left-0 md:z-20"
    : `${highlight_nt_decline ? "bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100" : "bg-background"} md:sticky md:left-24 md:z-20`;
}

function PeriodHeader({ label }) {
  const separator_index = label.indexOf(" (");

  if (separator_index < 0) {
    return label;
  }

  return (
    <span className="flex flex-col items-center leading-snug">
      <span>{label.slice(0, separator_index)}</span>
      <span>{label.slice(separator_index + 1)}</span>
    </span>
  );
}

export default function NilaiTransaksiTab({
  category_metrics,
  highest_daily,
  labels,
  rows,
  can_manage = false,
  on_edit,
  on_delete,
}) {
  const selected_date_label = labels?.selected_date_label || "tanggal terpilih";
  const selected_period_label = labels?.selected_period_label || "bulan ini";
  const selected_period_range_label = formatPeriodRangeLabel(selected_period_label);
  const previous_period_label = labels?.previous_period_label || "bulan lalu";
  const previous_month_label = labels?.previous_month_label || "bulan lalu";

  return (
    <Table
      fixedColumns="none"
      containerClassName="isolate max-h-[70vh] overflow-auto rounded-lg border"
      className="border-separate border-spacing-0 [&_td]:border-r [&_td]:border-b [&_th]:border-r [&_th]:border-b [&_tr>*:last-child]:border-r-0"
    >
      <TableHeader sticky={false} variant="none" className="sticky top-0 z-50">
        <TableRow>
          <TableHead className="sticky top-0 z-30 w-24 min-w-24 max-w-24 bg-orange-100 text-center text-orange-950 md:left-0 md:z-40">
            No.
          </TableHead>
          <TableHead className="sticky top-0 z-30 min-w-[240px] bg-orange-100 text-orange-950 md:left-24 md:z-40">
            Outlet
          </TableHead>
          {[
            ["Target", "min-w-[140px]"],
            ["Total Penerimaan Pendapatan (Harian)", "min-w-[180px]"],
            ["Kunjungan (Harian)", "min-w-[140px]"],
            [`Total Penerimaan Pendapatan ${selected_period_range_label}`, "min-w-[180px]"],
            [`Kunjungan ${selected_period_range_label}`, "min-w-[150px]"],
            [`Harian (${selected_date_label})`, "min-w-[140px]"],
            [selected_period_label, "min-w-[180px]"],
            [previous_period_label, "min-w-[180px]"],
            [`Growth % (dibanding ${previous_month_label})`, "min-w-[140px] text-center"],
            ["Gap Growth", "min-w-[160px] text-center"],
            ["% Dibanding Target", "min-w-[150px] text-center"],
            ["Gap Target", "min-w-[130px] text-center"],
          ].map(([label, className]) => (
            <TableHead
              key={label}
              className={`sticky top-0 z-30 bg-orange-100 text-orange-950 ${className}`}
            >
              <PeriodHeader label={label} />
            </TableHead>
          ))}
          {can_manage ? (
            <TableHead className="sticky top-0 z-30 min-w-[180px] bg-orange-100 text-center text-orange-950">
              Aksi
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row, index) => (
          <TableRow
            key={row.uuid}
            className={
              index === rows.length - 1
                ? "[&>td]:!border-b-0"
                : undefined
            }
          >
            <TableCell className={`${sticky_identity_class("number")} text-center`}>
              {index + 1}
            </TableCell>
            <TableCell className={`${sticky_identity_class("outlet", row.highlight_nt_decline)} font-medium`}>
              {row.outlet_name}
              {summaryExclusionLabel(row, "nilai_transaksi") && (
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{summaryExclusionLabel(row, "nilai_transaksi")}</span>
              )}
            </TableCell>
            <TableCell>
              <CurrencyValue value={row.nt_target} align="split" />
            </TableCell>
            <TableCell className="text-right">
              <CurrencyValue value={row.nt_daily_total_revenue} align="right" />
            </TableCell>
            <TableCell className="text-right">
              {formatDecimal(row.nt_daily_kunjungan, 0)}
            </TableCell>
            <TableCell className="text-right">
              <CurrencyValue value={row.nt_current_month_total_revenue} align="right" />
            </TableCell>
            <TableCell className="text-right">
              {formatDecimal(row.nt_current_month_kunjungan, 0)}
            </TableCell>
            <TableCell
              className={
                Number(row.nt_daily) === highest_daily
                  ? "bg-emerald-100 font-semibold text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100"
                  : undefined
              }
            >
              <CurrencyValue value={row.nt_daily} align="split" />
            </TableCell>
            <TableCell>
              <CurrencyValue value={row.nt_current_month} align="split" />
            </TableCell>
            <TableCell>
              <CurrencyValue value={row.nt_last_month} align="split" />
            </TableCell>
            <TableCell className="text-center">{formatPercentage(row.nt_growth)}</TableCell>
            <TableCell className={`text-center ${gapClassName(row.nt_gap_growth)}`}>
              {formatPercentage(row.nt_gap_growth)}
            </TableCell>
            <TableCell className="text-center">
              {formatPercentage(row.nt_target_compare)}
            </TableCell>
            <TableCell className={`text-center ${gapClassName(row.nt_gap_target)}`}>
              {formatPercentage(row.nt_gap_target)}
            </TableCell>
            {can_manage ? (
              <TableCell className="whitespace-nowrap">
                <div className="flex flex-nowrap items-center justify-center gap-2 whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => on_edit(row)}
                  >
                    <PencilIcon className="size-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="delete"
                    size="sm"
                    onClick={() => on_delete(row)}
                  >
                    <Trash2Icon className="size-4" />
                    Hapus
                  </Button>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}

        <TableRow className="bg-muted font-semibold hover:bg-muted [&>td]:border-t [&>td]:!border-b-0 [&>td]:border-border">
          <TableCell className="w-24 min-w-24 max-w-24 bg-muted text-center md:sticky md:bottom-0 md:left-0 md:z-40">
            Akumulasi
          </TableCell>
          <TableCell className="bg-muted md:sticky md:bottom-0 md:left-24 md:z-40">
            {rows.length} outlet
          </TableCell>
          <TableCell className="bg-muted md:sticky md:bottom-0 md:z-30">
            <CurrencyValue value={category_metrics.nt_target} align="split" />
          </TableCell>
          <TableCell className="bg-muted text-right md:sticky md:bottom-0 md:z-30">
            <CurrencyValue
              value={category_metrics.nt_daily_total_revenue}
              align="right"
            />
          </TableCell>
          <TableCell className="bg-muted text-right md:sticky md:bottom-0 md:z-30">
            {formatDecimal(category_metrics.nt_daily_kunjungan, 0)}
          </TableCell>
          <TableCell className="bg-muted text-right md:sticky md:bottom-0 md:z-30">
            <CurrencyValue
              value={category_metrics.nt_current_month_total_revenue}
              align="right"
            />
          </TableCell>
          <TableCell className="bg-muted text-right md:sticky md:bottom-0 md:z-30">
            {formatDecimal(category_metrics.nt_current_month_kunjungan, 0)}
          </TableCell>
          <TableCell className="bg-muted md:sticky md:bottom-0 md:z-30">
            <CurrencyValue value={category_metrics.nt_daily} align="split" />
          </TableCell>
          <TableCell className="bg-muted md:sticky md:bottom-0 md:z-30">
            <CurrencyValue value={category_metrics.nt_current_month} align="split" />
          </TableCell>
          <TableCell className="bg-muted md:sticky md:bottom-0 md:z-30">
            <CurrencyValue value={category_metrics.nt_last_month} align="split" />
          </TableCell>
          <TableCell className="bg-muted text-center md:sticky md:bottom-0 md:z-30">
            {formatPercentage(category_metrics.nt_growth)}
          </TableCell>
          <TableCell
            className={`text-center md:sticky md:bottom-0 md:z-30 ${gapClassName(category_metrics.nt_gap_growth)}`}
          >
            {formatPercentage(category_metrics.nt_gap_growth)}
          </TableCell>
          <TableCell className="bg-muted text-center md:sticky md:bottom-0 md:z-30">
            {formatPercentage(category_metrics.nt_target_compare)}
          </TableCell>
          <TableCell
            className={`text-center md:sticky md:bottom-0 md:z-30 ${gapClassName(category_metrics.nt_gap_target)}`}
          >
            {formatPercentage(category_metrics.nt_gap_target)}
          </TableCell>
          {can_manage ? (
            <TableCell className="bg-muted md:sticky md:bottom-0 md:z-30" />
          ) : null}
        </TableRow>
      </TableBody>
    </Table>
  );
}
