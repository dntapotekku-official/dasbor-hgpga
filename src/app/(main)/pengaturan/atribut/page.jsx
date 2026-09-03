"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import Pagination from "@/components/pagination";
import PageHeading from "@/components/page-heading";
import SortableTableHead from "@/components/sortable-table-head";
import { attribute_types } from "@/lib/atributInsanKu";
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
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import PengaturanRowSheet from "../component/pengaturan-row-sheet";

const PAGE_SIZE = 50;

export default function AtributPage() {
  const [attributes, setAttributes] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(attributes);
  const [selected_attribute, setSelectedAttribute] = useState(null);
  const [pending_attribute_update, setPendingAttributeUpdate] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [attribute_to_delete, setAttributeToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [is_type_change_pending, setIsTypeChangePending] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");

  const sorted_items = useMemo(() => {
    return [...filtered_items].sort((first, second) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      return String(first[sort_key] ?? "").localeCompare(
        String(second[sort_key] ?? ""),
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

  const fetch_attributes = async () => {
    const result = await fetch("/api/atribut");
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data atribut.");
    }

    return payload.data?.data_atribut ?? [];
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_attributes() {
      try {
        const data = await fetch_attributes();

        if (should_ignore) {
          return;
        }

        setAttributes(data);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data atribut.",
          );
        }
      }
    }

    void load_attributes();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const handle_create = async (new_attribute) => {
    const result = await fetch("/api/atribut", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: new_attribute.name,
        type: new_attribute.type,
        is_view: new_attribute.is_view,
        is_edit: new_attribute.is_edit,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      toast.error(payload.message || "Gagal menambahkan atribut.");
      return;
    }

    setAttributes((current) => [payload.data, ...current]);
    toast.success(payload.message || "Atribut berhasil ditambahkan.");
  };

  const commit_attribute_update = async (next_attribute) => {
    const result = await fetch("/api/atribut", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_atribut: next_attribute.uuid,
        name: next_attribute.name,
        type: next_attribute.type,
        is_view: next_attribute.is_view,
        is_edit: next_attribute.is_edit,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      toast.error(payload.message || "Gagal memperbarui atribut.");
      return;
    }

    setAttributes((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Atribut berhasil diperbarui.");
  };

  const handle_save = async (next_attribute) => {
    const previous_type = String(selected_attribute?.type ?? "").trim().toLowerCase();
    const next_type = String(next_attribute?.type ?? "").trim().toLowerCase();

    if (selected_attribute?.uuid && previous_type && next_type && previous_type !== next_type) {
      setPendingAttributeUpdate(next_attribute);
      return;
    }

    await commit_attribute_update(next_attribute);
  };

  const handle_confirm_type_change = async () => {
    if (!pending_attribute_update) {
      return;
    }

    setIsTypeChangePending(true);

    try {
      await commit_attribute_update(pending_attribute_update);
      setPendingAttributeUpdate(null);
    } finally {
      setIsTypeChangePending(false);
    }
  };

  const handle_delete = async () => {
    if (!attribute_to_delete) {
      return;
    }

    setIsDeletePending(true);

    try {
      const result = await fetch("/api/atribut", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_atribut: attribute_to_delete.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus atribut.");
      }

      setAttributes((current) =>
        current.filter((item) => item.uuid !== attribute_to_delete.uuid),
      );
      setAttributeToDelete(null);
      toast.success(payload.message || "Atribut berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus atribut.",
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
          description="Kelola master atribut yang dipakai oleh data karyawan InsanKu."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>Atribut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari atribut..."
                  className="w-full sm:max-w-sm"
                />
                <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
                  <Button
                    type="button"
                    onClick={() => setIsCreateSheetOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <PlusIcon className="size-4" />
                    Tambah Atribut
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
                            label="Nama Atribut"
                            sortKey="name"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead>
                          <SortableTableHead
                            label="Jenis"
                            sortKey="type"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead className="w-[140px]">Lihat</TableHead>
                        <TableHead className="w-[140px]">Edit</TableHead>
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
                          <TableCell>{attribute_types.find((item) => item.value === row.type)?.label ?? row.type}</TableCell>
                          <TableCell>{row.is_view ? "Ya" : "Tidak"}</TableCell>
                          <TableCell>{row.is_edit ? "Ya" : "Tidak"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAttribute(row);
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
                                onClick={() => setAttributeToDelete(row)}
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
                    Data tidak tersedia.
                  </div>
                ) : (
                  <Pagination
                    current_page={current_page}
                    page_size={PAGE_SIZE}
                    total_items={filtered_items.length}
                    total_pages={total_pages}
                    item_label="atribut"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                )}
              </div>

              <PengaturanRowSheet
                key={selected_attribute?.uuid ?? "atribut-sheet"}
                open={is_sheet_open}
                on_open_change={setIsSheetOpen}
                title="Edit Atribut"
                item={selected_attribute}
                fields={[
                  {
                    key: "name",
                    label: "Nama Atribut",
                    placeholder: "Masukkan nama atribut",
                  },
                  {
                    key: "type",
                    label: "Jenis Atribut",
                    type: "select",
                    placeholder: "Pilih jenis atribut",
                    options: attribute_types,
                  },
                  {
                    key: "is_view",
                    label: "Boleh Dilihat di InsanKu",
                    type: "checkbox",
                    placeholder: "Tampilkan atribut ini di InsanKu",
                    on_change: (draft, checked) => ({
                      is_view: checked,
                      is_edit: checked ? Boolean(draft.is_edit) : false,
                    }),
                  },
                  {
                    key: "is_edit",
                    label: "Boleh Diedit di InsanKu",
                    type: "checkbox",
                    placeholder: "Izinkan atribut ini diedit di InsanKu",
                    disabled: (draft) => !draft.is_view,
                    helper: (draft) =>
                      draft.is_view
                        ? null
                        : "Aktifkan tampil di InsanKu terlebih dahulu untuk mengizinkan edit.",
                  },
                ]}
                on_save={handle_save}
              />

              <PengaturanRowSheet
                key="atribut-create-sheet"
                open={is_create_sheet_open}
                on_open_change={setIsCreateSheetOpen}
                title="Tambah Atribut"
                item={{
                  name: "",
                  type: attribute_types[0]?.value ?? "string",
                  is_view: false,
                  is_edit: false,
                }}
                fields={[
                  {
                    key: "name",
                    label: "Nama Atribut",
                    placeholder: "Masukkan nama atribut",
                  },
                  {
                    key: "type",
                    label: "Jenis Atribut",
                    type: "select",
                    placeholder: "Pilih jenis atribut",
                    options: attribute_types,
                  },
                  {
                    key: "is_view",
                    label: "Boleh Dilihat di InsanKu",
                    type: "checkbox",
                    placeholder: "Tampilkan atribut ini di InsanKu",
                    on_change: (draft, checked) => ({
                      is_view: checked,
                      is_edit: checked ? Boolean(draft.is_edit) : false,
                    }),
                  },
                  {
                    key: "is_edit",
                    label: "Boleh Diedit di InsanKu",
                    type: "checkbox",
                    placeholder: "Izinkan atribut ini diedit di InsanKu",
                    disabled: (draft) => !draft.is_view,
                    helper: (draft) =>
                      draft.is_view
                        ? null
                        : "Aktifkan tampil di InsanKu terlebih dahulu untuk mengizinkan edit.",
                  },
                ]}
                on_save={handle_create}
              />

              <ConfirmActionDialog
                open={Boolean(attribute_to_delete)}
                onOpenChange={(open) => {
                  if (!open) {
                    setAttributeToDelete(null);
                  }
                }}
                title="Hapus atribut"
                description={`Atribut "${attribute_to_delete?.name ?? "-"}" akan disembunyikan dari daftar aktif.`}
                confirmLabel="Ya, hapus"
                confirmVariant="delete"
                isPending={is_delete_pending}
                onConfirm={handle_delete}
              />

              <ConfirmActionDialog
                open={Boolean(pending_attribute_update)}
                onOpenChange={(open) => {
                  if (!open) {
                    setPendingAttributeUpdate(null);
                  }
                }}
                title="Ubah jenis atribut"
                description="Perubahan jenis atribut akan memengaruhi data karyawan yang sudah ada. Sistem akan memeriksa kecocokan data lama terlebih dahulu sebelum menyimpan perubahan."
                confirmLabel="Ya, ubah jenis"
                isPending={is_type_change_pending}
                onConfirm={handle_confirm_type_change}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
