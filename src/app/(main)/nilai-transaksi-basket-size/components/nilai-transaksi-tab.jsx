import {
  formatDecimal,
  formatPercentage,
  gapClassName,
} from "@/lib/nilaiTransaksiBasketSizeTable";
import CurrencyValue from "@/components/currency-value";
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

function sticky_identity_class(column) {
  return column === "number"
    ? "sticky left-0 z-20 w-24 min-w-24 max-w-24 bg-background"
    : "sticky left-24 z-20 bg-background";
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

function period_range_label(label) {
  const normalized_label = String(label ?? "");
  const separator_index = normalized_label.indexOf(" (");

  return separator_index < 0
    ? normalized_label
    : normalized_label.slice(separator_index + 1);
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
  const selected_period_range_label = period_range_label(selected_period_label);
  const previous_period_label = labels?.previous_period_label || "bulan lalu";
  const previous_month_label = labels?.previous_month_label || "bulan lalu";

  return (
    <Table
      containerClassName="max-h-[70vh] overflow-auto rounded-lg border"
      className="border-separate border-spacing-0 [&_td]:border-r [&_td]:border-b [&_th]:border-r [&_th]:border-b [&_tr>*:last-child]:border-r-0"
    >
      <TableHeader variant="none" className="sticky top-0 z-30">
        <TableRow>
          <TableHead className="sticky top-0 left-0 z-40 w-24 min-w-24 max-w-24 bg-orange-100 text-center text-orange-950">
            No
          </TableHead>
          <TableHead className="sticky top-0 left-24 z-40 min-w-[240px] bg-orange-100 text-orange-950">
            Outlet
          </TableHead>
          {[
            ["Target", "min-w-[140px]"],
            ["Total Pendapatan Harian", "min-w-[180px]"],
            ["Dilayani (Harian)", "min-w-[140px]"],
            [`Total Pendapatan ${selected_period_range_label}`, "min-w-[180px]"],
            [`Dilayani ${selected_period_range_label}`, "min-w-[150px]"],
            [`Harian (${selected_date_label})`, "min-w-[140px]"],
            [selected_period_label, "min-w-[180px]"],
            [previous_period_label, "min-w-[180px]"],
            [`Growth % (dibanding ${previous_month_label})`, "min-w-[140px] text-center"],
            ["Selisih Pertumbuhan", "min-w-[160px] text-center"],
            ["Pencapaian Target", "min-w-[150px] text-center"],
            ["Selisih Target", "min-w-[130px] text-center"],
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
            <TableCell className={`${sticky_identity_class("outlet")} font-medium`}>
              {row.outlet_name}
            </TableCell>
            <TableCell>
              <CurrencyValue value={row.nt_target} align="split" />
            </TableCell>
            <TableCell className="text-right">
              <CurrencyValue value={row.nt_daily_total_revenue} align="right" />
            </TableCell>
            <TableCell className="text-right">
              {formatDecimal(row.nt_daily_served, 0)}
            </TableCell>
            <TableCell className="text-right">
              <CurrencyValue value={row.nt_current_month_total_revenue} align="right" />
            </TableCell>
            <TableCell className="text-right">
              {formatDecimal(row.nt_current_month_served, 0)}
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
              <TableCell>
                <div className="flex justify-center gap-2">
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
          <TableCell className="sticky bottom-0 left-0 z-40 w-24 min-w-24 max-w-24 bg-muted text-center">
            Akumulasi
          </TableCell>
          <TableCell className="sticky bottom-0 left-24 z-40 bg-muted">
            {rows.length} outlet
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted">
            <CurrencyValue value={category_metrics.nt_target} align="split" />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-right">
            <CurrencyValue
              value={category_metrics.nt_daily_total_revenue}
              align="right"
            />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-right">
            {formatDecimal(category_metrics.nt_daily_served, 0)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-right">
            <CurrencyValue
              value={category_metrics.nt_current_month_total_revenue}
              align="right"
            />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-right">
            {formatDecimal(category_metrics.nt_current_month_served, 0)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted">
            <CurrencyValue value={category_metrics.nt_daily} align="split" />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted">
            <CurrencyValue value={category_metrics.nt_current_month} align="split" />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted">
            <CurrencyValue value={category_metrics.nt_last_month} align="split" />
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatPercentage(category_metrics.nt_growth)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.nt_gap_growth)}`}
          >
            {formatPercentage(category_metrics.nt_gap_growth)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatPercentage(category_metrics.nt_target_compare)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.nt_gap_target)}`}
          >
            {formatPercentage(category_metrics.nt_gap_target)}
          </TableCell>
          {can_manage ? (
            <TableCell className="sticky bottom-0 z-30 bg-muted" />
          ) : null}
        </TableRow>
      </TableBody>
    </Table>
  );
}
