"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import Pagination from "@/components/pagination";
import OptionDropdown from "@/components/option-dropdown";
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

export default function InsanKuTab() {
  const [sync_status, setSyncStatus] = useState("pending");
  const [outlet, setOutlet] = useState([]);
  const [insanku, setInsanKu] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(insanku, ["name"]);
  const [selected_outlet, setSelectedOutlet] = useState("all");
  const [selected_insanku, setSelectedInsanKu] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const outlet_options = useMemo(
    () => [
      { value: "all", label: "Semua outlet" },
      ...outlet.map((item) => ({ value: item.uuid, label: item.name })),
    ],
    [outlet],
  );
  const outlet_filtered_items = useMemo(
    () =>
      selected_outlet === "all"
        ? filtered_items
        : filtered_items.filter((item) =>
            item.outlet_uuids?.includes(selected_outlet),
          ),
    [filtered_items, selected_outlet],
  );
  const sorted_items = useMemo(() => {
    return [...outlet_filtered_items].sort((a, b) => {
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
  }, [outlet_filtered_items, sort_direction, sort_key]);
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

  const fetch_insanku = async () => {
    const [outlet_result, insanku_result] = await Promise.all([
      fetch("/api/outlet"),
      fetch("/api/insanku"),
    ]);
    const [outlet_data, insanku_data] = await Promise.all([
      outlet_result.json(),
      insanku_result.json(),
    ]);

    if (!outlet_result.ok || !outlet_data.success) {
      throw new Error(outlet_data.message || "Gagal mengambil data outlet.");
    }

    if (!insanku_result.ok || !insanku_data.success) {
      throw new Error(insanku_data.message || "Gagal mengambil data InsanKu.");
    }

    return {
      outlet: outlet_data.data.data_outlet,
      insanku: insanku_data.data.data_insanku,
    };
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_insanku() {
      try {
        const data = await fetch_insanku();

        if (should_ignore) {
          return;
        }

        setOutlet(data.outlet);
        setInsanKu(data.insanku);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data InsanKu.",
          );
        }
      }
    }

    void load_insanku();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selected_outlet, setCurrentPage]);

  const sync_insanku_handler = async () => {
    try {
      setSyncStatus("syncing");

      const insanku_result = await fetch("/api/insanku", { method: "POST" });
      const insanku_payload = await insanku_result.json();

      if (!insanku_result.ok || !insanku_payload.success) {
        throw new Error(
          insanku_payload.message || "Sinkronisasi data InsanKu gagal dijalankan.",
        );
      }

      const outlet_insanku_result = await fetch("/api/outlet-insanku", {
        method: "POST",
      });
      const outlet_insanku_payload = await outlet_insanku_result.json();

      if (!outlet_insanku_result.ok || !outlet_insanku_payload.success) {
        throw new Error(
          outlet_insanku_payload.message ||
            "Sinkronisasi penempatan InsanKu gagal dijalankan.",
        );
      }

      const latest_data = await fetch_insanku();
      setOutlet(latest_data.outlet);
      setInsanKu(latest_data.insanku);
      toast.success("Sinkronisasi data InsanKu berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi InsanKu.",
      );
    } finally {
      setSyncStatus("pending");
    }
  };

  const handle_save = async (next_insanku) => {
    const response = await fetch("/api/insanku", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_insanku: next_insanku.uuid,
        name: next_insanku.name,
        username: next_insanku.username,
        password: next_insanku.password,
        outlet_placements: next_insanku.outlet_placements ?? [],
        outlet_uuids: next_insanku.outlet_uuids ?? [],
        is_skip_sync_insanku: next_insanku.is_skip_sync_insanku,
        is_skip_sync_outlet_insanku: next_insanku.is_skip_sync_outlet_insanku,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data InsanKu.");
    }

    setInsanKu((current) =>
      current.map((item) =>
        item.uuid === payload.data.uuid ? payload.data : item,
      ),
    );
    toast.success(payload.message || "Data InsanKu berhasil diperbarui.");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-sm leading-5">
          Sebelum menekan <strong>Sinkron InsanKu</strong>, {" "}
          <strong>sinkronkan Outlet terlebih dahulu</strong> melalui menu Outlet.
        </p>
      </div>

      <Card className="gap-0 border-t-2 border-t-primary/70">
        <CardHeader className="border-b">
          <CardTitle>InsanKu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama InsanKu..."
                className="w-full lg:max-w-sm"
              />
              <OptionDropdown
                value={selected_outlet}
                onValueChange={setSelectedOutlet}
                options={outlet_options}
                searchable
                ariaLabel="Filter outlet InsanKu"
                searchPlaceholder="Cari outlet..."
                emptySearchMessage="Outlet tidak ditemukan."
                triggerClassName="w-full lg:w-64"
              />
              <SyncActionButton
                onConfirm={sync_insanku_handler}
                title="Konfirmasi sinkronisasi InsanKu"
                description="Sinkronisasi akan memperbarui data InsanKu beserta penempatan outlet terbaru dari sumber utama."
                confirmLabel="Ya, sinkronkan InsanKu"
                idleLabel="Sinkron"
                isPending={sync_status === "syncing"}
                className="w-full shrink-0 lg:w-auto"
              />
            </div>

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
                            setSelectedInsanKu(row);
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

            {outlet_filtered_items.length === 0 ? (
              <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada InsanKu yang cocok dengan pencarian.
              </div>
            ) : (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={outlet_filtered_items.length}
                total_pages={total_pages}
                item_label="InsanKu"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>

          <PengaturanRowSheet
            key={selected_insanku?.uuid ?? "insanku-sheet"}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title="Edit InsanKu"
            description="Perbarui data InsanKu pada tampilan pengaturan."
            item={selected_insanku}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama InsanKu",
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
                key: "is_skip_sync_insanku",
                label: "Lewati saat sinkron (kecuali penempatan)",
                type: "checkbox",
              },
              {
                key: "is_skip_sync_outlet_insanku",
                label: "Lewati saat sinkron (penempatan saja)",
                type: "checkbox",
                disabled: (draft) =>
                  !Array.isArray(draft.outlet_placements) ||
                  draft.outlet_placements.length === 0,
                helper: (draft) =>
                  !Array.isArray(draft.outlet_placements) ||
                  draft.outlet_placements.length === 0
                    ? "Checkbox ini aktif setelah InsanKu memiliki minimal satu outlet."
                    : "Checkbox ini berlaku untuk semua penempatan outlet milik InsanKu ini.",
              },
            ]}
            on_save={handle_save}
          />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
