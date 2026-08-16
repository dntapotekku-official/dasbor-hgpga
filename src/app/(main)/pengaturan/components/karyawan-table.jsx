"use client";

import { useEffect } from "react";

import Pagination from "@/components/pagination";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

export default function KaryawanTable({ data = [] }) {
  const { search, setSearch, filtered_items } = useSearch(data);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(filtered_items, PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Cari karyawan..."
        className="max-w-sm"
      />

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-20">#</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Outlet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated_rows.map((row, index) => (
                <TableRow key={row.uuid}>
                  <TableCell>
                    {(current_page - 1) * PAGE_SIZE + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>{row.outlet_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filtered_items.length === 0 ? (
          <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            Tidak ada karyawan yang cocok dengan pencarian.
          </div>
        ) : (
          <Pagination
            current_page={current_page}
            page_size={PAGE_SIZE}
            total_items={filtered_items.length}
            total_pages={total_pages}
            item_label="karyawan"
            on_previous={previous_page}
            on_next={next_page}
          />
        )}
      </div>
    </div>
  );
}
