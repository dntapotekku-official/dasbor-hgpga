"use client";

import { useEffect, useState } from "react";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import PageHeading from "@/components/page-heading";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "../components/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function DataOutletPage() {
  const [syncStatus, setSyncStatus] = useState("pending");
  const [outlet, setOutlet] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(outlet);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(filtered_items, PAGE_SIZE);

  const fetch_outlet = async () => {
    const result = await fetch("/api/outlet");
    const data = await result.json();

    if (!result.ok || !data.success) {
      throw new Error(data.message || "Gagal mengambil data outlet.");
    }

    return {
      outlet: data.data.data_outlet,
    };
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_outlet() {
      try {
        const data = await fetch_outlet();

        if (should_ignore) {
          return;
        }

        setOutlet(data.outlet);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data outlet.",
          );
        }
      }
    }

    void load_outlet();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const sync_outlet_handler = async () => {
    try {
      setSyncStatus("syncing");

      const result = await fetch("/api/outlet", {
        method: "POST",
      });
      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Sinkronisasi outlet gagal dijalankan.");
      }

      const latest_data = await fetch_outlet();
      setOutlet(latest_data.outlet);
      toast.success("Sinkronisasi data outlet berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi outlet.",
      );
    } finally {
      setSyncStatus("pending");
    }
  };

  const handle_save = async (next_outlet) => {
    const response = await fetch("/api/outlet", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: "outlet",
        uuid_outlet: next_outlet.uuid,
        name: next_outlet.name,
        is_skip_sync: next_outlet.is_skip_sync
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data outlet.");
    }

    setOutlet((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Data outlet berhasil diperbarui.");
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Sinkronkan dan pantau data outlet, karyawan, dan admin."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Data Outlet</CardTitle>
              <CardDescription>
                Kelola data outlet yang dipakai oleh fitur dasbor HGPGA.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={sync_outlet_handler}
              disabled={syncStatus === "syncing"}
              className="w-full sm:w-auto"
            >
              {syncStatus === "syncing" ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Menyinkronkan...
                </>
              ) : (
                "Sinkron"
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari outlet..."
                className="max-w-sm"
              />

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-20">#</TableHead>
                        <TableHead>Nama Outlet</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated_rows.map((row, index) => (
                        <TableRow key={row.uuid}>
                          <TableCell>
                            {(current_page - 1) * PAGE_SIZE + index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOutlet(row);
                                setIsSheetOpen(true);
                              }}
                            >
                              <PencilIcon className="size-4" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filtered_items.length === 0 ? (
                  <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                    Tidak ada outlet yang cocok dengan pencarian.
                  </div>
                ) : (
                  <Pagination
                    current_page={current_page}
                    page_size={PAGE_SIZE}
                    total_items={filtered_items.length}
                    total_pages={total_pages}
                    item_label="outlet"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                )}
              </div>
              
              <PengaturanRowSheet
                key={selectedOutlet?.uuid ?? "outlet-sheet"}
                open={isSheetOpen}
                on_open_change={setIsSheetOpen}
                title="Edit Outlet"
                description="Perbarui data outlet pada tampilan pengaturan."
                item={selectedOutlet}
                fields={[
                  {
                    key: "name",
                    label: "Nama Outlet",
                    placeholder: "Masukkan nama outlet",
                  },
                  {
                    key: "is_skip_sync",
                    label: "Lewati saat sinkron",
                    type: "checkbox"
                  }
                ]}
                on_save={handle_save}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
