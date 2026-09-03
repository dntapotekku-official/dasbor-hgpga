"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import SyncActionButton from "@/components/sync-action-button";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "../../component/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function KaryawanTab() {
  const [sync_status, setSyncStatus] = useState("pending");
  const [outlet, setOutlet] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(karyawan);
  const [selected_karyawan, setSelectedKaryawan] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const sorted_items = useMemo(() => {
    return [...filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;
      const first_value = sort_key === "outlet_names"
        ? (a.outlet_names ?? []).join(", ")
        : a[sort_key];
      const second_value = sort_key === "outlet_names"
        ? (b.outlet_names ?? []).join(", ")
        : b[sort_key];

      return String(first_value ?? "").localeCompare(
        String(second_value ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [filtered_items, sort_direction, sort_key]);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_items, PAGE_SIZE);

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection("asc");
  };

  const fetch_karyawan = async () => {
    const [outlet_result, karyawan_result] = await Promise.all([
      fetch("/api/outlet"),
      fetch("/api/karyawan"),
    ]);
    const [outlet_data, karyawan_data] = await Promise.all([
      outlet_result.json(),
      karyawan_result.json(),
    ]);

    if (!outlet_result.ok || !outlet_data.success) {
      throw new Error(outlet_data.message || "Gagal mengambil data outlet.");
    }

    if (!karyawan_result.ok || !karyawan_data.success) {
      throw new Error(karyawan_data.message || "Gagal mengambil data karyawan.");
    }

    return {
      outlet: outlet_data.data.data_outlet,
      karyawan: karyawan_data.data.data_karyawan,
    };
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_karyawan() {
      try {
        const data = await fetch_karyawan();

        if (should_ignore) {
          return;
        }

        setOutlet(data.outlet);
        setKaryawan(data.karyawan);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data karyawan.",
          );
        }
      }
    }

    void load_karyawan();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const sync_karyawan_handler = async () => {
    try {
      setSyncStatus("syncing");

      const karyawan_result = await fetch("/api/karyawan", { method: "POST" });
      const karyawan_payload = await karyawan_result.json();

      if (!karyawan_result.ok || !karyawan_payload.success) {
        throw new Error(
          karyawan_payload.message || "Sinkronisasi data karyawan gagal dijalankan.",
        );
      }

      const outlet_karyawan_result = await fetch("/api/outlet-karyawan", {
        method: "POST",
      });
      const outlet_karyawan_payload = await outlet_karyawan_result.json();

      if (!outlet_karyawan_result.ok || !outlet_karyawan_payload.success) {
        throw new Error(
          outlet_karyawan_payload.message ||
            "Sinkronisasi penempatan karyawan gagal dijalankan.",
        );
      }

      const latest_data = await fetch_karyawan();
      setOutlet(latest_data.outlet);
      setKaryawan(latest_data.karyawan);
      toast.success("Sinkronisasi data karyawan berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi karyawan.",
      );
    } finally {
      setSyncStatus("pending");
    }
  };

  const handle_save = async (next_karyawan) => {
    const response = await fetch("/api/karyawan", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_karyawan: next_karyawan.uuid,
        name: next_karyawan.name,
        username: next_karyawan.username,
        password: next_karyawan.password,
        outlet_placements: next_karyawan.outlet_placements ?? [],
        outlet_uuids: next_karyawan.outlet_uuids ?? [],
        is_skip_sync_karyawan: next_karyawan.is_skip_sync_karyawan,
        is_skip_sync_outlet_karyawan: next_karyawan.is_skip_sync_outlet_karyawan,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data karyawan.");
    }

    setKaryawan((current) =>
      current.map((item) =>
        item.uuid === payload.data.uuid ? payload.data : item,
      ),
    );
    toast.success(payload.message || "Data karyawan berhasil diperbarui.");
  };

  return (
    <Card className="gap-0 border-t-2 border-t-primary/70">
      <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Karyawan</CardTitle>
        <SyncActionButton
          onConfirm={sync_karyawan_handler}
          description="Sinkronisasi akan memperbarui data karyawan beserta penempatan outlet terbaru dari sumber utama."
          isPending={sync_status === "syncing"}
          className="w-full sm:w-auto"
        />
      </CardHeader>
      <CardContent>
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
                    <TableHead>
                      <SortableTableHead
                        label="Nama"
                        sortKey="name"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Username"
                        sortKey="username"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Outlet"
                        sortKey="outlet_names"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated_rows.map((row, index) => (
                    <TableRow key={row.uuid}>
                      <TableCell>{(current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>
                        {Array.isArray(row.outlet_names) && row.outlet_names.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {row.outlet_names.map((outlet_name) => (
                              <li key={`${row.uuid}-${outlet_name}`}>{outlet_name}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedKaryawan(row);
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

          <PengaturanRowSheet
            key={selected_karyawan?.uuid ?? "karyawan-sheet"}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title="Edit Karyawan"
            description="Perbarui data karyawan pada tampilan pengaturan."
            item={selected_karyawan}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama karyawan",
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              {
                key: "password",
                label: "Password Baru",
                placeholder: "Kosongkan jika tidak diubah",
              },
              {
                key: "outlet_placements",
                label: "Outlet",
                type: "placement-list",
                options: outlet.map((item) => ({
                  value: item.uuid,
                  label: item.name,
                })),
              },
              {
                key: "is_skip_sync_karyawan",
                label: "Lewati saat sinkron (kecuali penempatan)",
                type: "checkbox",
              },
              {
                key: "is_skip_sync_outlet_karyawan",
                label: "Lewati saat sinkron (penempatan saja)",
                type: "checkbox",
                disabled: (draft) =>
                  !Array.isArray(draft.outlet_placements) ||
                  draft.outlet_placements.length === 0,
                helper: (draft) =>
                  !Array.isArray(draft.outlet_placements) ||
                  draft.outlet_placements.length === 0
                    ? "Checkbox ini aktif setelah karyawan memiliki minimal satu outlet."
                    : "Checkbox ini berlaku untuk semua penempatan outlet milik karyawan ini.",
              },
            ]}
            on_save={handle_save}
          />
        </div>
      </CardContent>
    </Card>
  );
}
