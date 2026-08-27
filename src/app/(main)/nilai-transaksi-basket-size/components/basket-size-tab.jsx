import {
  formatDecimal,
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
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

function sticky_identity_class(column) {
  return column === "number"
    ? "sticky left-0 z-20 w-24 min-w-24 max-w-24 bg-background"
    : "sticky left-24 z-20 bg-background";
}

export default function BasketSizeTab({
  category_metrics,
  labels,
  rows,
  can_manage = false,
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
            "Target",
            previous_period_label,
            `Capaian ${selected_period_label}`,
            `Growth % (dibanding ${previous_month_label})`,
            "Gap Growth",
            "% Dari Target",
            "Gap Target"
          ].map((label) => (
            <TableHead
              key={label}
              className="sticky top-0 z-30 min-w-[120px] bg-blue-200 text-center text-blue-950"
            >
              {label}
            </TableHead>
          ))}
          {can_manage ? (
            <TableHead className="sticky top-0 z-30 min-w-[110px] bg-blue-200 text-center text-blue-950">
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
            <TableCell className="text-center">{formatDecimal(row.bs_target)}</TableCell>
            <TableCell className="text-center">
              {formatDecimal(row.bs_last_month)}
            </TableCell>
            <TableCell className="text-center">
              {formatDecimal(row.bs_current_month)}
            </TableCell>
            <TableCell className="text-center">{formatDecimal(row.bs_growth)}</TableCell>
            <TableCell className={`text-center ${gapClassName(row.bs_gap_growth)}`}>
              {formatDecimal(row.bs_gap_growth)}
            </TableCell>
            <TableCell className="text-center">
              {formatDecimal(row.bs_target_compare)}
            </TableCell>
            <TableCell className={`text-center ${gapClassName(row.bs_gap_target)}`}>
              {formatDecimal(row.bs_gap_target)}
            </TableCell>
            {can_manage ? (
              <TableCell className="text-center">
                <Button
                  type="button"
                  variant="delete"
                  size="sm"
                  onClick={() => on_delete(row)}
                >
                  <Trash2Icon className="size-4" />
                  Hapus
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}

        <TableRow className="bg-muted font-semibold hover:bg-muted [&>td]:border-t [&>td]:!border-b-0 [&>td]:border-border">
          <TableCell className="sticky bottom-0 left-0 z-40 w-24 min-w-24 max-w-24 bg-muted text-center">
            TOTAL
          </TableCell>
          <TableCell className="sticky bottom-0 left-24 z-40 bg-muted">
            {rows.length} outlet
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_target)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_last_month)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_current_month)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_growth)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.bs_gap_growth)}`}
          >
            {formatDecimal(category_metrics.bs_gap_growth)}
          </TableCell>
          <TableCell className="sticky bottom-0 z-30 bg-muted text-center">
            {formatDecimal(category_metrics.bs_target_compare)}
          </TableCell>
          <TableCell
            className={`sticky bottom-0 z-30 text-center ${gapClassName(category_metrics.bs_gap_target)}`}
          >
            {formatDecimal(category_metrics.bs_gap_target)}
          </TableCell>
          {can_manage ? (
            <TableCell className="sticky bottom-0 z-30 bg-muted" />
          ) : null}
        </TableRow>
      </TableBody>
    </Table>
  );
}
