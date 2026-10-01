"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import Pagination from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import usePagination from "@/hooks/usePagination";

const PAGE_SIZE = 10;

function DetailRows({ rows, group, on_edit_row, on_delete_row }) {
  return rows.map((row) => (
    <TableRow key={row.uuid}>
      <TableCell className="whitespace-normal">
        <div className="font-medium">{row.name}</div>
      </TableCell>
      <TableCell className="font-medium">{row.today_input}</TableCell>
      <TableCell>{row.product_name ?? "-"}</TableCell>
      <TableCell>
        <div className="flex gap-2">
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

export default function DetailTabContent({
  outlet_groups,
  is_outlet_view = false,
  on_add_sale,
  on_edit_row,
  on_delete_row,
}) {
  const {
    current_page,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(outlet_groups, PAGE_SIZE);

  if (!outlet_groups.length) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Data outlet belum tersedia.
      </div>
    );
  }

  if (is_outlet_view) {
    const rows = outlet_groups.flatMap((group) =>
      (group.detail_rows ?? []).map((row) => ({
        group,
        row,
      })),
    );

    return (
      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <Table className="min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
            <TableRow>
              <TableHead className="w-[32%]">Nama</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Produk</TableHead>
              <TableHead className="w-[20%]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map(({ group, row }) => (
                <TableRow key={row.uuid}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{row.name}</div>
                  </TableCell>
                  <TableCell className="font-medium">{row.today_input}</TableCell>
                  <TableCell>{row.product_name ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Belum ada detail penjualan untuk tanggal ini.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
        {paginated_rows.map((group) => (
          <Card key={group.uuid} className="gap-0 bg-orange-50/60 shadow-none">
            <CardContent>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-heading text-lg leading-snug font-semibold tracking-tight">
                  {group.outlet_name}
                </h3>
                <Button
                  type="button"
                  onClick={() => on_add_sale?.(group)}
                  className="w-full shrink-0 sm:w-auto"
                >
                  <PlusIcon className="size-4" />
                  Tambah Penjualan
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-primary [&_th]:text-primary-foreground">
                    <TableRow>
                      <TableHead className="w-[32%]">Nama</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead className="w-[20%]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <DetailRows
                      rows={group.detail_rows}
                      group={group}
                      on_edit_row={on_edit_row}
                      on_delete_row={on_delete_row}
                    />
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {outlet_groups.length > PAGE_SIZE ? (
        <Pagination
          current_page={current_page}
          page_size={PAGE_SIZE}
          total_items={outlet_groups.length}
          total_pages={total_pages}
          item_label="outlet"
          on_previous={previous_page}
          on_next={next_page}
        />
      ) : null}
    </div>
  );
}
