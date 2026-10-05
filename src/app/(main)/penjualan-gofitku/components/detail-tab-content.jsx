"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function format_date_label(date_value) {
  const date = new Date(`${date_value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return date_value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function DetailRows({ rows, group, on_edit_row, on_delete_row }) {
  return rows.map((row, index) => (
    <TableRow key={row.uuid}>
      <TableCell className="w-14 text-center">{index + 1}</TableCell>
      <TableCell className="whitespace-normal">
        <div className="font-medium">{row.name}</div>
      </TableCell>
      <TableCell className="font-medium">{row.today_input}</TableCell>
      <TableCell>{row.product_name ?? "-"}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => on_edit_row(group, row)}
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="delete"
            size="sm"
            onClick={() => on_delete_row(group, row)}
          >
            <Trash2Icon className="size-4" />
            Hapus
          </Button>
        </div>
      </TableCell>
    </TableRow>
  ));
}

function DetailTable({
  rows,
  group,
  empty_message,
  on_edit_row,
  on_delete_row,
}) {
  return (
    <Table className="min-w-[760px]" containerClassName="overflow-visible">
      <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
        <TableRow>
          <TableHead className="w-14 text-center">No.</TableHead>
          <TableHead className="w-[32%]">Nama</TableHead>
          <TableHead>Jumlah</TableHead>
          <TableHead>Produk</TableHead>
          <TableHead className="w-[20%]">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          <DetailRows
            rows={rows}
            group={group}
            on_edit_row={on_edit_row}
            on_delete_row={on_delete_row}
          />
        ) : (
          <TableRow>
            <TableCell
              colSpan={5}
              className="h-24 text-center text-sm text-muted-foreground"
            >
              {empty_message}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function DailyDetailGroups({ group, on_edit_row, on_delete_row }) {
  const daily_groups = group.monthly_detail_groups ?? [];

  if (!daily_groups.length) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <DetailTable
          rows={[]}
          group={group}
          empty_message="Belum ada detail penjualan untuk bulan ini."
          on_edit_row={on_edit_row}
          on_delete_row={on_delete_row}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {daily_groups.map((daily_group) => (
        <div
          key={`${group.uuid}-${daily_group.date}`}
          className="overflow-hidden rounded-lg border bg-card"
        >
          <div className="border-b bg-muted/40 px-4 py-2 font-medium">
            {format_date_label(daily_group.date)}
          </div>
          <DetailTable
            rows={daily_group.rows ?? []}
            group={group}
            empty_message="Belum ada detail penjualan untuk tanggal ini."
            on_edit_row={on_edit_row}
            on_delete_row={on_delete_row}
          />
        </div>
      ))}
    </div>
  );
}

export default function DetailTabContent({
  outlet_groups,
  is_outlet_view = false,
  on_edit_row,
  on_delete_row,
}) {
  if (!outlet_groups.length) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Data outlet belum tersedia.
      </div>
    );
  }

  if (is_outlet_view) {
    const daily_groups = outlet_groups.flatMap((group) =>
      (group.monthly_detail_groups ?? []).map((daily_group) => ({
        group,
        daily_group,
      })),
    );

    return (
      <div className="max-h-[70vh] space-y-4 overflow-auto rounded-lg border bg-muted/20 p-3">
        {daily_groups.length ? (
          daily_groups.map(({ group, daily_group }) => (
            <div
              key={`${group.uuid}-${daily_group.date}`}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="border-b bg-muted/40 px-4 py-2 font-medium">
                {format_date_label(daily_group.date)}
              </div>
              <DetailTable
                rows={daily_group.rows ?? []}
                group={group}
                empty_message="Belum ada detail penjualan untuk tanggal ini."
                on_edit_row={on_edit_row}
                on_delete_row={on_delete_row}
              />
            </div>
          ))
        ) : (
          <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada detail penjualan untuk bulan ini.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto rounded-lg border bg-muted/20 p-3">
      {outlet_groups.map((group) => (
        <DailyDetailGroups
          key={group.uuid}
          group={group}
          on_edit_row={on_edit_row}
          on_delete_row={on_delete_row}
        />
      ))}
    </div>
  );
}
