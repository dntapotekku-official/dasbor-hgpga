"use client";

import CurrencyValue from "@/components/currency-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function format_percentage(total, target) {
  if (!target) {
    return "0%";
  }

  return `${Math.round((total / target) * 100)}%`;
}

function get_status(total, target, input = null) {
  if ((input ?? total) <= 0) {
    return {
      label: "Belum input",
      class_name: "bg-amber-100 text-amber-700",
    };
  }

  if (total >= target) {
    return {
      label: "Target tercapai",
      class_name: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Perlu dikejar",
    class_name: "bg-sky-100 text-sky-700",
  };
}

export default function RingkasanTabContent({
  outlet_groups,
}) {
  if (!outlet_groups.length) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Data outlet belum tersedia.
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
      {outlet_groups.map((group) => {
        const totals = group.rows.reduce(
          (current_totals, row) => ({
            today_input: current_totals.today_input + Number(row.today_input || 0),
            today_revenue:
              current_totals.today_revenue + Number(row.today_revenue || 0),
            monthly_total: current_totals.monthly_total + Number(row.monthly_total || 0),
            monthly_revenue:
              current_totals.monthly_revenue + Number(row.monthly_revenue || 0),
            target: current_totals.target + Number(row.target || 0),
          }),
          {
            today_input: 0,
            today_revenue: 0,
            monthly_total: 0,
            monthly_revenue: 0,
            target: 0,
          },
        );

        return (
          <Card key={`${group.uuid}-summary`} className="gap-0 bg-orange-50/60 shadow-none">
            <CardHeader>
              <CardTitle>{group.outlet_name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table className="min-w-[1120px]">
                  <TableHeader className="bg-primary [&_th]:text-primary-foreground">
                    <TableRow>
                      <TableHead className="w-[32%]">Nama</TableHead>
                      <TableHead>Total Hari Ini</TableHead>
                      <TableHead>Total Penjualan Hari Ini</TableHead>
                      <TableHead>Total Bulan Ini</TableHead>
                      <TableHead>Total Penjualan Bulan Ini</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Persentase</TableHead>
                      <TableHead className="w-[18%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => {
                      const status = get_status(
                        row.monthly_total,
                        row.target,
                        row.today_input,
                      );

                      return (
                        <TableRow key={row.uuid}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">{row.name}</div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.today_input}
                          </TableCell>
                          <TableCell className="font-medium">
                            <CurrencyValue value={row.today_revenue} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.monthly_total}
                          </TableCell>
                          <TableCell className="font-medium">
                            <CurrencyValue value={row.monthly_revenue} />
                          </TableCell>
                          <TableCell>{row.target}</TableCell>
                          <TableCell>
                            {format_percentage(row.monthly_total, row.target)}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.class_name}`}
                            >
                              {status.label}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-semibold hover:bg-transparent">
                      <TableCell className="whitespace-normal border-t bg-muted">TOTAL</TableCell>
                      <TableCell className="border-t bg-muted">{totals.today_input}</TableCell>
                      <TableCell className="border-t bg-muted">
                        <CurrencyValue value={totals.today_revenue} />
                      </TableCell>
                      <TableCell className="border-t bg-muted">{totals.monthly_total}</TableCell>
                      <TableCell className="border-t bg-muted">
                        <CurrencyValue value={totals.monthly_revenue} />
                      </TableCell>
                      <TableCell className="border-t bg-muted">{totals.target}</TableCell>
                      <TableCell className="border-t bg-muted">
                        {format_percentage(totals.monthly_total, totals.target)}
                      </TableCell>
                      <TableCell className="whitespace-normal border-t bg-muted text-muted-foreground">
                        {(() => {
                          const status = get_status(
                            totals.monthly_total,
                            totals.target,
                            totals.today_input,
                          );

                          return (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 border text-xs font-medium ${status.class_name}`}
                            >
                              {status.label}
                            </span>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
