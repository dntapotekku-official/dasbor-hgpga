"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import OptionDropdown from "@/components/option-dropdown";
import PageHeading from "@/components/page-heading";
import { attribute_types } from "@/lib/atributInsanKu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useSearch from "@/hooks/useSearch";
import { get_socket } from "@/lib/socket-client";
import PengaturanRowSheet from "../component/pengaturan-row-sheet";

function sort_attributes_by_order(items) {
  return [...items].sort((first, second) => {
    const first_order = Number(first.order ?? 0);
    const second_order = Number(second.order ?? 0);

    if (first_order !== second_order) {
      return first_order - second_order;
    }

    return String(first.name ?? "").localeCompare(String(second.name ?? ""), "id-ID");
  });
}

function get_attribute_type_label(type) {
  return attribute_types.find((item) => item.value === type)?.label ?? type;
}

export default function AtributPage() {
  const [attributes, setAttributes] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(attributes, ["name"]);
  const [selected_type, setSelectedType] = useState("all");
  const [selected_attribute, setSelectedAttribute] = useState(null);
  const [pending_attribute_update, setPendingAttributeUpdate] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [attribute_to_delete, setAttributeToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [is_type_change_pending, setIsTypeChangePending] = useState(false);
  const [dragged_attribute_uuid, setDraggedAttributeUuid] = useState(null);
  const [drag_over_attribute_uuid, setDragOverAttributeUuid] = useState(null);
  const [is_reorder_pending, setIsReorderPending] = useState(false);

  const ordered_filtered_items = useMemo(
    () =>
      sort_attributes_by_order(
        selected_type === "all"
          ? filtered_items
          : filtered_items.filter((item) => item.type === selected_type),
      ),
    [filtered_items, selected_type],
  );

  const get_range_options = (current_uuid, current_range_uuid) => [
    { value: "", label: "Tidak menggunakan rentang" },
    ...attributes
      .filter(
        (item) =>
          item.type === "date" &&
          item.uuid !== current_uuid &&
          (!item.range_with || item.uuid === current_range_uuid),
      )
      .map((item) => ({
        value: item.uuid,
        label: item.name,
      })),
  ];

  const fetch_attributes = useCallback(async () => {
    const result = await fetch("/api/atribut", {
      cache: "no-store",
    });
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data atribut.");
    }

    return payload.data?.data_atribut ?? [];
  }, []);

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
  }, [fetch_attributes]);

  useEffect(() => {
    const socket = get_socket();

    const refresh_attributes = () => {
      void fetch_attributes()
        .then((data) => setAttributes(data))
        .catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal memperbarui data atribut otomatis.",
          );
        });
    };

    socket.on("connect", refresh_attributes);
    socket.on("attribute.master.changed", refresh_attributes);

    return () => {
      socket.off("connect", refresh_attributes);
      socket.off("attribute.master.changed", refresh_attributes);
    };
  }, [fetch_attributes]);

  const handle_create = async (new_attribute) => {
    const result = await fetch("/api/atribut", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: new_attribute.name,
        type: new_attribute.type,
        is_attribute: new_attribute.is_attribute,
        range_with: new_attribute.range_with,
        is_view: new_attribute.is_view,
        is_edit: new_attribute.is_edit,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menambahkan atribut.");
    }

    setAttributes((current) => sort_attributes_by_order([...current, payload.data]));
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
        is_attribute: next_attribute.is_attribute,
        range_with: next_attribute.range_with,
        is_view: next_attribute.is_view,
        is_edit: next_attribute.is_edit,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui atribut.");
    }

    setAttributes((current) =>
      sort_attributes_by_order(
        current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
      ),
    );
    toast.success(payload.message || "Atribut berhasil diperbarui.");
  };

  const persist_attribute_order = async (next_attributes) => {
    const result = await fetch("/api/atribut", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ordered_uuids: next_attributes.map((item) => item.uuid),
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal memperbarui urutan atribut.");
    }
  };

  const reorder_attributes = async (source_uuid, target_uuid) => {
    if (!source_uuid || !target_uuid || source_uuid === target_uuid) {
      return;
    }

    const previous_attributes = attributes;
    const source_index = attributes.findIndex((item) => item.uuid === source_uuid);
    const target_index = attributes.findIndex((item) => item.uuid === target_uuid);

    if (source_index < 0 || target_index < 0) {
      return;
    }

    const next_attributes = [...attributes];
    const [moved_attribute] = next_attributes.splice(source_index, 1);

    next_attributes.splice(target_index, 0, moved_attribute);

    const reordered_attributes = next_attributes.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    try {
      setIsReorderPending(true);
      setAttributes(reordered_attributes);
      await persist_attribute_order(reordered_attributes);
    } catch (error) {
      setAttributes(previous_attributes);
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui urutan atribut.",
      );
    } finally {
      setIsReorderPending(false);
    }
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui atribut.",
      );
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
        description="Kelola daftar kolom atribut untuk data InsanKu."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>Kolom Atribut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari kolom atribut..."
                  className="w-full sm:max-w-sm"
                />
                <OptionDropdown
                  value={selected_type}
                  onValueChange={setSelectedType}
                  options={[
                    { value: "all", label: "Semua tipe" },
                    ...attribute_types,
                  ]}
                  ariaLabel="Filter tipe kolom atribut"
                  triggerClassName="w-full sm:w-48"
                />
                <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
                  <Button
                    type="button"
                    onClick={() => setIsCreateSheetOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <PlusIcon className="size-4" />
                    Tambah Kolom Atribut
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                {ordered_filtered_items.length ? (
                  <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
                    {ordered_filtered_items.map((row, index) => (
                      <div
                        key={row.uuid}
                        draggable={!is_reorder_pending}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", row.uuid);
                          setDraggedAttributeUuid(row.uuid);
                        }}
                        onDragEnter={() => setDragOverAttributeUuid(row.uuid)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverAttributeUuid(row.uuid);
                        }}
                        onDragLeave={() => setDragOverAttributeUuid(null)}
                        onDrop={(event) => {
                          event.preventDefault();
                          const source_uuid =
                            event.dataTransfer.getData("text/plain") ||
                            dragged_attribute_uuid;

                          setDraggedAttributeUuid(null);
                          setDragOverAttributeUuid(null);
                          void reorder_attributes(source_uuid, row.uuid);
                        }}
                        onDragEnd={() => {
                          setDraggedAttributeUuid(null);
                          setDragOverAttributeUuid(null);
                        }}
                        className={`group flex overflow-hidden rounded-xl border bg-card shadow-sm transition ${
                          drag_over_attribute_uuid === row.uuid
                            ? "border-primary/70 bg-primary/5"
                            : "border-border"
                        } ${
                          dragged_attribute_uuid === row.uuid
                            ? "opacity-60"
                            : "opacity-100"
                          }`}
                      >
                        <div className="flex w-16 shrink-0 items-center justify-center border-r bg-muted/20">
                          <button
                            type="button"
                            className="cursor-grab rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
                            aria-label={`Geser urutan ${row.name}`}
                            disabled={is_reorder_pending}
                          >
                            <GripVerticalIcon className="size-5" />
                          </button>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                  #{index + 1}
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                  {get_attribute_type_label(row.type)}
                                </span>
                              </div>
                              <h3 className="truncate text-lg font-semibold">
                                {row.name}
                              </h3>
                              <div className="flex flex-wrap gap-2 text-sm">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                                    row.is_attribute
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <ListChecksIcon className="size-4" />
                                  {row.is_attribute
                                    ? "Atribut InsanKu"
                                    : "Kolom biasa"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                                    row.is_view
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {row.is_view ? (
                                    <EyeIcon className="size-4" />
                                  ) : (
                                    <EyeOffIcon className="size-4" />
                                  )}
                                  {row.is_view ? "Bisa dilihat" : "Tidak ditampilkan"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                                    row.is_edit
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <span className="relative inline-flex size-4 items-center justify-center">
                                    <PencilIcon className="size-4" />
                                    {!row.is_edit ? (
                                      <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-current" />
                                    ) : null}
                                  </span>
                                  {row.is_edit ? "Bisa diedit" : "Tidak bisa diedit"}
                                </span>
                              </div>
                            </div>

                          <div className="flex shrink-0 gap-2 sm:justify-end">
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
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                    Data tidak tersedia.
                  </div>
                )}
              </div>

              <PengaturanRowSheet
                key={selected_attribute?.uuid ?? "atribut-sheet"}
                open={is_sheet_open}
                on_open_change={setIsSheetOpen}
                title="Edit Kolom Atribut"
                item={selected_attribute}
                fields={[
                  {
                    key: "name",
                    label: "Nama Kolom Atribut",
                    placeholder: "Masukkan nama kolom atribut",
                  },
                  {
                    key: "type",
                    label: "Jenis Kolom Atribut",
                    type: "select",
                    placeholder: "Pilih jenis kolom atribut",
                    options: attribute_types,
                    on_change: (draft, next_type) =>
                      next_type === "date" ? {} : { range_with: "" },
                  },
                  {
                    key: "range_with",
                    label: "Buat rentang dengan",
                    type: "select",
                    options: get_range_options(
                      selected_attribute?.uuid,
                      selected_attribute?.range_with,
                    ),
                    disabled: (draft) => draft.type !== "date",
                    helper: (draft) =>
                      draft.type === "date"
                        ? "Pilih kolom tanggal lain sebagai pasangan rentang."
                        : "Opsi rentang hanya tersedia untuk kolom bertipe tanggal.",
                  },
                  {
                    key: "is_attribute",
                    label: "Jadikan Atribut InsanKu",
                    type: "checkbox",
                    placeholder: "Gunakan kolom ini sebagai atribut InsanKu",
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
                title="Tambah Kolom Atribut"
                item={{
                  name: "",
                  type: attribute_types[0]?.value ?? "string",
                  is_view: false,
                  is_attribute: false,
                  range_with: "",
                  is_edit: false,
                }}
                fields={[
                  {
                    key: "name",
                    label: "Nama Kolom Atribut",
                    placeholder: "Masukkan nama kolom atribut",
                  },
                  {
                    key: "type",
                    label: "Jenis Kolom Atribut",
                    type: "select",
                    placeholder: "Pilih jenis kolom atribut",
                    options: attribute_types,
                    on_change: (draft, next_type) =>
                      next_type === "date" ? {} : { range_with: "" },
                  },
                  {
                    key: "range_with",
                    label: "Buat rentang dengan",
                    type: "select",
                    options: get_range_options(),
                    disabled: (draft) => draft.type !== "date",
                    helper: (draft) =>
                      draft.type === "date"
                        ? "Pilih kolom tanggal lain sebagai pasangan rentang."
                        : "Opsi rentang hanya tersedia untuk kolom bertipe tanggal.",
                  },
                  {
                    key: "is_attribute",
                    label: "Jadikan Atribut InsanKu",
                    type: "checkbox",
                    placeholder: "Gunakan kolom ini sebagai atribut InsanKu",
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
                title="Hapus kolom atribut"
                description={`Kolom atribut "${attribute_to_delete?.name ?? "-"}" akan disembunyikan dari daftar aktif.`}
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
                title="Ubah jenis kolom atribut"
                description="Perubahan jenis kolom atribut akan memengaruhi data InsanKu yang sudah ada. Sistem akan memeriksa kecocokan data lama terlebih dahulu sebelum menyimpan perubahan."
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
