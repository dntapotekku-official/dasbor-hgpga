import {
  formatDecimal,
  formatPercentage,
  gapClassName,
} from "@/lib/nilaiTransaksiBasketSizeTable";
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

const BS_DECIMAL_PLACES = 3;
const BS_PERCENT_DECIMAL_PLACES = 3;

function sticky_identity_class(column) {
  return column === "number"
    ? "sticky left-0 z-20 w-24 min-w-24 max-w-24 bg-background"
    : "sticky left-24 z-20 bg-background";
}

function PeriodHeader({ label, prefix = null, prefix_as_title = false }) {
  const separator_index = label.indexOf(" (");

  if (separator_index < 0) {
    return prefix ? `${prefix} ${label}` : label;
  }

  return (
    <span className="flex flex-col items-center leading-snug">
      <span>
        {prefix_as_title
          ? prefix
          : <>{prefix ? `${prefix} ` : ""}{label.slice(0, separator_index)}</>}
      </span>
      <span>{label.slice(separator_index + 1)}</span>
    </span>
  );
}

export default function BasketSizeTab({
  category_metrics,
  highest_achievement,
  labels,
  rows,
  can_manage = false,
  on_edit,
  on_delete,
}) {
  const selected_period_label = labels?.selected_period_label || "bulan ini";
  const previous_period_label = labels?.previous_period_label || "bulan lalu";
  const previous_month_label = labels?.previous_month_label || "bulan lalu";

  return (
    <Table
      containerClassName="max-h-[70vh] overflow-auto rounded-lg border"
      className="border-separate border-spacing-0 [&_td]:border-r [&_td]:border-b [&_th]:border-r [&_th]:border-b [&_tr>*:last-child]:border-r-0"
    >
      <TableHeader variant="none" className="sticky top-0 z-30">
        <TableRow>
          <TableHead className="sticky top-0 left-0 z-40 w-24 min-w-24 max-w-24 bg-blue-200 text-center text-blue-950">
            No
          </TableHead>
          <TableHead className="sticky top-0 left-24 z-40 min-w-[240px] bg-blue-200 text-blue-950">
            Outlet
          </TableHead>
          {[
            { key: "target", label: "Target" },
            { key: "sku-qty", label: "Jumlah SKU" },
            { key: "kunjungan", label: "Kunjungan" },
            {
              key: "selected-period",
              label: (
                <PeriodHeader
                  label={selected_period_label}
                  prefix="Capaian"
                  prefix_as_title
                />
              ),
            },
            { key: "previous-period", label: <PeriodHeader label={previous_period_label} /> },
            {
              key: "growth",
              label: (
                <PeriodHeader
                  label={`Growth % (dibanding ${previous_month_label})`}
                />
              ),
            },
            { key: "gap-growth", label: "Gap Growth" },
            { key: "target-percentage", label: "% Dibanding Target" },
            { key: "gap-target", label: "Gap Target" },
          ].map((header) => (
            <TableHead
              key={header.key}
              className="sticky top-0 z-30 min-w-[120px] bg-blue-200 text-center text-blue-950"
            >
              {header.label}
            </TableHead>
          ))}
          {can_manage ? (
            <TableHead className="sticky top-0 z-30 min-w-[180px] bg-blue-200 text-center text-blue-950">
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
            <TableCell className="text-center">
              {formatDecimal(row.bs_target, BS_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className="text-center">
              {formatDecimal(row.bs_current_month_sku_qty, 0)}
            </TableCell>
            <TableCell className="text-right">
              {formatDecimal(row.bs_current_month_kunjungan, 0)}
            </TableCell>
            <TableCell
              className={
                Number(row.bs_current_month) === highest_achievement
                  ? "bg-emerald-100 text-center font-semibold text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-100"
                  : "text-center"
              }
            >
              {formatDecimal(row.bs_current_month, BS_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className="text-center">
              {formatDecimal(row.bs_last_month, BS_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className="text-center">
              {formatPercentage(row.bs_growth, BS_PERCENT_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className={`text-center ${gapClassName(row.bs_gap_growth)}`}>
              {formatPercentage(row.bs_gap_growth, BS_PERCENT_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className="text-center">
              {formatPercentage(row.bs_target_compare, BS_PERCENT_DECIMAL_PLACES)}
            </TableCell>
            <TableCell className={`text-center ${gapClassName(row.bs_gap_target)}`}>
              {formatPercentage(row.bs_gap_target, BS_PERCENT_DECIMAL_PLACES)}
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
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_target, BS_DECIMAL_PLACES)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_current_month_sku_qty, 0)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-right">
            {formatDecimal(category_metrics.bs_current_month_kunjungan, 0)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_current_month, BS_DECIMAL_PLACES)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_last_month, BS_DECIMAL_PLACES)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatPercentage(category_metrics.bs_growth, BS_PERCENT_DECIMAL_PLACES)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.bs_gap_growth)}`}
          >
            {formatPercentage(category_metrics.bs_gap_growth, BS_PERCENT_DECIMAL_PLACES)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatPercentage(category_metrics.bs_target_compare, BS_PERCENT_DECIMAL_PLACES)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.bs_gap_target)}`}
          >
            {formatPercentage(category_metrics.bs_gap_target, BS_PERCENT_DECIMAL_PLACES)}
          </TableCell>
          {can_manage ? (
            <TableCell className="sticky bottom-0 z-30 bg-muted" />
          ) : null}
        </TableRow>
      </TableBody>
    </Table>
  );
}
