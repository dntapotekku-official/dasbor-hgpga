"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import Pagination from "@/components/pagination";
import PageHeading from "@/components/page-heading";
import SortableTableHead from "@/components/sortable-table-head";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "../component/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

export default function ProdukGofitkuPage() {
  const [produk, setProduk] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(produk, ["name"]);
  const [selected_produk, setSelectedProduk] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [produk_to_delete, setProdukToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const sorted_items = useMemo(() => {
    return [...filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      return String(a[sort_key] ?? "").localeCompare(
        String(b[sort_key] ?? ""),
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

  const fetch_produk = async () => {
    const result = await fetch("/api/produk-gofitku");
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data produk GoFitKu.");
    }

    return {
      produk: payload.data.data_produk_gofitku,
    };
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_produk() {
      try {
        const data = await fetch_produk();

        if (should_ignore) {
          return;
        }

        setProduk(data.produk);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data produk GoFitKu.",
          );
        }
      }
    }

    void load_produk();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const handle_create = async (new_produk) => {
    const result = await fetch("/api/produk-gofitku", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: new_produk.name,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menambahkan produk GoFitKu.");
    }

    setProduk((current) => [payload.data, ...current]);
    toast.success(payload.message || "Produk GoFitKu berhasil ditambahkan.");
  };

  const handle_save = async (next_produk) => {
    const result = await fetch("/api/produk-gofitku", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_produk_gofitku: next_produk.uuid,
        name: next_produk.name,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui produk GoFitKu.");
    }

    setProduk((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Produk GoFitKu berhasil diperbarui.");
  };

  const handle_delete = async () => {
    if (!produk_to_delete) {
      return;
    }

    setIsDeletePending(true);

    try {
      const result = await fetch("/api/produk-gofitku", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_produk_gofitku: produk_to_delete.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus produk GoFitKu.");
      }

      setProduk((current) => current.filter((item) => item.uuid !== produk_to_delete.uuid));
      setProdukToDelete(null);
      toast.success(payload.message || "Produk GoFitKu berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus produk GoFitKu.",
      );
    } finally {
      setIsDeletePending(false);
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Kelola produk dan target yang dipakai oleh fitur GoFitKu."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>Produk GoFitKu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari produk..."
                  className="w-full sm:max-w-sm"
                />
                <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
                  <Button
                    type="button"
                    onClick={() => setIsCreateSheetOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <PlusIcon className="size-4" />
                    Tambah Produk
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-20">#</TableHead>
                        <TableHead>
                          <SortableTableHead
                            label="Nama Produk"
                            sortKey="name"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead className="w-[180px]">Aksi</TableHead>
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
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedProduk(row);
                                  setIsSheetOpen(true);
                                }}
                              >
                                <PencilIcon className="size-4" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="delete"
                                size="sm"
                                onClick={() => setProdukToDelete(row)}
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

                {filtered_items.length === 0 ? (
                  <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                    Tidak ada produk GoFitKu yang cocok dengan pencarian.
                  </div>
                ) : (
                  <Pagination
                    current_page={current_page}
                    page_size={PAGE_SIZE}
                    total_items={filtered_items.length}
                    total_pages={total_pages}
                    item_label="produk"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                )}
              </div>

              <PengaturanRowSheet
                key={selected_produk?.uuid ?? "produk-gofitku-sheet"}
                open={is_sheet_open}
                on_open_change={setIsSheetOpen}
                title="Edit Produk GoFitKu"
                description="Perbarui nama produk pada daftar GoFitKu."
                item={selected_produk}
                fields={[
                  {
                    key: "name",
                    label: "Nama Produk",
                    placeholder: "Masukkan nama produk",
                  },
                ]}
                on_save={handle_save}
              />

              <PengaturanRowSheet
                key="produk-gofitku-create-sheet"
                open={is_create_sheet_open}
                on_open_change={setIsCreateSheetOpen}
                title="Tambah Produk GoFitKu"
                description="Tambahkan produk baru ke daftar GoFitKu."
                item={{
                  name: "",
                }}
                fields={[
                  {
                    key: "name",
                    label: "Nama Produk",
                    placeholder: "Masukkan nama produk",
                  },
                ]}
                on_save={handle_create}
              />

              <ConfirmActionDialog
                open={Boolean(produk_to_delete)}
                onOpenChange={(open) => {
                  if (!open) {
                    setProdukToDelete(null);
                  }
                }}
                title="Hapus produk GoFitKu"
                description={`Produk "${produk_to_delete?.name ?? "-"}" akan disembunyikan dari daftar aktif.`}
                confirmLabel="Ya, hapus"
                confirmVariant="delete"
                isPending={is_delete_pending}
                onConfirm={handle_delete}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
