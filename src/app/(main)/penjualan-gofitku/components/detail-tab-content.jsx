"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <CardHeader className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <CardTitle>{group.outlet_name}</CardTitle>
            <Button
              type="button"
              onClick={() => on_add_sales(group)}
              className="w-full sm:w-auto"
            >
              Tambah Penjualan
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
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
