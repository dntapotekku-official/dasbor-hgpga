"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

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

export default function DetailTabContent({
  outlet_groups,
  on_add_sales,
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

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
      {outlet_groups.map((group) => (
        <Card key={group.uuid} className="gap-0 bg-orange-50/60 shadow-none">
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-heading text-lg leading-snug font-semibold tracking-tight">
                {group.outlet_name}
              </h3>
              <Button
                type="button"
                onClick={() => on_add_sales(group)}
                className="shrink-0"
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
                  {group.detail_rows.map((row) => (
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
