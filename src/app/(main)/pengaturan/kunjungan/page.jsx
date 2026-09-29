"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  MoveRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import FilterField from "@/components/filter-field";
import ImportDataModal from "@/app/(main)/nilai-transaksi-basket-size/components/import-data-modal";
import OptionDropdown from "@/components/option-dropdown";
import PageHeading from "@/components/page-heading";
import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import usePagination from "@/hooks/usePagination";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import FieldLabel from "@/components/field-label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 50;

function format_date_label(value) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function KunjunganSheet({
  open,
  title,
  item,
  outlets,
  on_open_change,
  on_save,
}) {
  const [draft, setDraft] = useState(() => ({
    uuid_outlet: item?.uuid_outlet ?? "",
    date: item?.date ?? new Date().toISOString().slice(0, 10),
    value: String(item?.value ?? ""),
  }));
  const [is_submitting, setIsSubmitting] = useState(false);

  const reset_draft = () => {
    setDraft({
      uuid_outlet: item?.uuid_outlet ?? "",
      date: item?.date ?? new Date().toISOString().slice(0, 10),
      value: String(item?.value ?? ""),
    });
  };

  const outlet_options = useMemo(
    () => [
      {
        value: "",
        label: "Pilih outlet",
      },
      ...outlets.map((outlet) => ({
        value: outlet.uuid,
        label: outlet.name,
      })),
    ],
    [outlets],
  );

  const handle_save = async () => {
    setIsSubmitting(true);

    try {
      await on_save({
        ...item,
        uuid_outlet: draft.uuid_outlet,
        date: draft.date,
        value: draft.value,
      });
      on_open_change(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan kunjungan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next_open) => {
        if (is_submitting && !next_open) {
          return;
        }

        if (!next_open) {
          reset_draft();
        }

        on_open_change(next_open);
      }}
    >
      <SheetContent className="w-full sm:max-w-lg" showCloseButton={!is_submitting}>
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="uuid_outlet" label="Outlet" required />
            <OptionDropdown
              id="uuid_outlet"
              value={draft.uuid_outlet}
              options={outlet_options}
              onValueChange={(next_value) =>
                setDraft((current) => ({
                  ...current,
                  uuid_outlet: next_value,
                }))
              }
              ariaLabel="Pilih outlet kunjungan"
              searchable
              searchPlaceholder="Cari outlet..."
              emptyMessage="Outlet tidak ditemukan."
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="date" label="Tanggal" required />
            <Input
              id="date"
              type="date"
              value={draft.date}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="value" label="Kunjungan" required />
            <Input
              id="value"
              type="number"
              min="1"
              step="1"
              value={draft.value}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  value: event.target.value,
                }))
              }
              placeholder="Masukkan jumlah kunjungan"
            />
            <p className="text-xs text-muted-foreground">
              Nilai ini menjadi penyebut bersama untuk Nilai Transaksi dan Basket Size.
            </p>
          </div>
        </div>
        <div className="border-t p-4">
          <Button
            type="button"
            onClick={handle_save}
            className="w-full"
            disabled={is_submitting}
            aria-busy={is_submitting}
          >
            {is_submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function first_day_of_month_value() {
  const now = new Date();
  const first_day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  return first_day.toISOString().slice(0, 10);
}

function KunjunganBulananSheet({
  open,
  title,
  item,
  outlets,
  on_open_change,
  on_save,
}) {
  const [draft, setDraft] = useState(() => ({
    uuid_outlet: item?.uuid_outlet ?? "",
    from_date: item?.from_date ?? first_day_of_month_value(),
    to_date: item?.to_date ?? new Date().toISOString().slice(0, 10),
    value: String(item?.value ?? ""),
  }));
  const [is_submitting, setIsSubmitting] = useState(false);

  const reset_draft = () => {
    setDraft({
      uuid_outlet: item?.uuid_outlet ?? "",
      from_date: item?.from_date ?? first_day_of_month_value(),
      to_date: item?.to_date ?? new Date().toISOString().slice(0, 10),
      value: String(item?.value ?? ""),
    });
  };

  const outlet_options = useMemo(
    () => [
      {
        value: "",
        label: "Pilih outlet",
      },
      ...outlets.map((outlet) => ({
        value: outlet.uuid,
        label: outlet.name,
      })),
    ],
    [outlets],
  );

  const handle_save = async () => {
    setIsSubmitting(true);

    try {
      await on_save({
        ...item,
        uuid_outlet: draft.uuid_outlet,
        from_date: draft.from_date,
        to_date: draft.to_date,
        value: draft.value,
      });
      on_open_change(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan kunjungan bulanan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next_open) => {
        if (is_submitting && !next_open) {
          return;
        }

        if (!next_open) {
          reset_draft();
        }

        on_open_change(next_open);
      }}
    >
      <SheetContent className="w-full sm:max-w-lg" showCloseButton={!is_submitting}>
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="uuid_outlet_bulanan" label="Outlet" required />
            <OptionDropdown
              id="uuid_outlet_bulanan"
              value={draft.uuid_outlet}
              options={outlet_options}
              onValueChange={(next_value) =>
                setDraft((current) => ({
                  ...current,
                  uuid_outlet: next_value,
                }))
              }
              ariaLabel="Pilih outlet kunjungan bulanan"
              searchable
              searchPlaceholder="Cari outlet..."
              emptyMessage="Outlet tidak ditemukan."
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="from_date" label="Rentang Tanggal" required />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <Input
                id="from_date"
                type="date"
                value={draft.from_date}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    from_date: event.target.value,
                  }))
                }
              />
              <div className="flex items-center justify-center text-muted-foreground">
                <MoveRightIcon className="size-4 rotate-90 sm:rotate-0" />
                <span className="sr-only">sampai</span>
              </div>
              <Input
                id="to_date"
                type="date"
                value={draft.to_date}
                min={draft.from_date}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    to_date: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Contoh: Dari 2025-09-01 sampai 2025-09-10, lalu 2025-09-01 sampai
            2025-09-11, dan seterusnya.
          </p>

          <div className="space-y-2">
            <FieldLabel htmlFor="value_bulanan" label="Kunjungan" required />
            <Input
              id="value_bulanan"
              type="number"
              min="1"
              step="1"
              value={draft.value}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  value: event.target.value,
                }))
              }
              placeholder="Masukkan jumlah kunjungan 1 - 10, 1 - 11, dst."
            />
          </div>
        </div>
        <div className="border-t p-4">
          <Button
            type="button"
            onClick={handle_save}
            className="w-full"
            disabled={is_submitting}
            aria-busy={is_submitting}
          >
            {is_submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function KunjunganPage() {
  const [active_tab, setActiveTab] = useState("harian");
  const [kunjungan, setKunjungan] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [selected_kunjungan, setSelectedKunjungan] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [is_import_modal_open, setIsImportModalOpen] = useState(false);
  const [is_importing, setIsImporting] = useState(false);
  const [kunjungan_to_delete, setKunjunganToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);
  const [sort_key, setSortKey] = useState("date");
  const [sort_direction, setSortDirection] = useState("desc");
  const [selected_outlet, setSelectedOutlet] = useState("all");
  const [selected_date, setSelectedDate] = useState("");
  const [kunjungan_bulanan, setKunjunganBulanan] = useState([]);
  const [selected_kunjungan_bulanan, setSelectedKunjunganBulanan] = useState(null);
  const [is_bulanan_sheet_open, setIsBulananSheetOpen] = useState(false);
  const [is_bulanan_create_open, setIsBulananCreateOpen] = useState(false);
  const [kunjungan_bulanan_to_delete, setKunjunganBulananToDelete] = useState(null);
  const [is_bulanan_delete_pending, setIsBulananDeletePending] = useState(false);
  const [sort_bulanan_key, setSortBulananKey] = useState("to_date");
  const [sort_bulanan_direction, setSortBulananDirection] = useState("desc");
  const [selected_outlet_bulanan, setSelectedOutletBulanan] = useState("all");
  const [filter_from_bulanan, setFilterFromBulanan] = useState("");
  const [filter_to_bulanan, setFilterToBulanan] = useState("");
  const outlet_filter_options = useMemo(
    () => [
      { value: "all", label: "Semua outlet" },
      ...outlets.map((item) => ({ value: item.uuid, label: item.name })),
    ],
    [outlets],
  );
  const filtered_items = useMemo(
    () =>
      kunjungan.filter(
        (item) =>
          (selected_outlet === "all" ||
            item.uuid_outlet === selected_outlet) &&
          (!selected_date || item.date === selected_date),
      ),
    [kunjungan, selected_date, selected_outlet],
  );
  const sorted_items = useMemo(() => {
    return [...filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      if (sort_key === "outlet_name") {
        return a.outlet_name.localeCompare(b.outlet_name, "id-ID") * direction;
      }

      if (sort_key === "value") {
        return ((Number(a.value) || 0) - (Number(b.value) || 0)) * direction;
      }

      return String(a.date ?? "").localeCompare(String(b.date ?? "")) * direction;
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
  const filtered_bulanan_items = useMemo(
    () =>
      kunjungan_bulanan.filter(
        (item) =>
          (selected_outlet_bulanan === "all" ||
            item.uuid_outlet === selected_outlet_bulanan) &&
          (!filter_from_bulanan || item.to_date >= filter_from_bulanan) &&
          (!filter_to_bulanan || item.from_date <= filter_to_bulanan),
      ),
    [kunjungan_bulanan, selected_outlet_bulanan, filter_from_bulanan, filter_to_bulanan],
  );
  const sorted_bulanan_items = useMemo(() => {
    return [...filtered_bulanan_items].sort((a, b) => {
      const direction = sort_bulanan_direction === "asc" ? 1 : -1;

      if (sort_bulanan_key === "outlet_name") {
        return a.outlet_name.localeCompare(b.outlet_name, "id-ID") * direction;
      }

      if (sort_bulanan_key === "value") {
        return ((Number(a.value) || 0) - (Number(b.value) || 0)) * direction;
      }

      if (sort_bulanan_key === "from_date") {
        return String(a.from_date ?? "").localeCompare(String(b.from_date ?? "")) * direction;
      }

      return String(a.to_date ?? "").localeCompare(String(b.to_date ?? "")) * direction;
    });
  }, [filtered_bulanan_items, sort_bulanan_direction, sort_bulanan_key]);
  const {
    current_page: current_bulanan_page,
    setCurrentPage: setCurrentBulananPage,
    total_pages: total_bulanan_pages,
    paginated_rows: paginated_bulanan_rows,
    previous_page: previous_bulanan_page,
    next_page: next_bulanan_page,
  } = usePagination(sorted_bulanan_items, PAGE_SIZE);

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection(next_sort_key === "outlet_name" ? "asc" : "desc");
  };

  const toggle_bulanan_sort = (next_sort_key) => {
    if (sort_bulanan_key === next_sort_key) {
      setSortBulananDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortBulananKey(next_sort_key);
    setSortBulananDirection(next_sort_key === "outlet_name" ? "asc" : "desc");
  };

  const fetch_kunjungan = async () => {
    const result = await fetch("/api/kunjungan");
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data kunjungan.");
    }

    return {
      kunjungan: payload.data.data_kunjungan ?? [],
      outlets: payload.data.data_outlet ?? [],
    };
  };

  const fetch_kunjungan_bulanan = async () => {
    const result = await fetch("/api/kunjungan-bulanan");
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data kunjungan bulanan.");
    }

    return payload.data.data_kunjungan_bulanan ?? [];
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_kunjungan() {
      try {
        const [data, data_bulanan] = await Promise.all([
          fetch_kunjungan(),
          fetch_kunjungan_bulanan(),
        ]);

        if (should_ignore) {
          return;
        }

        setKunjungan(data.kunjungan);
        setOutlets(data.outlets);
        setKunjunganBulanan(data_bulanan);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data kunjungan.",
          );
        }
      }
    }

    void load_kunjungan();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selected_date, selected_outlet, setCurrentPage]);

  useEffect(() => {
    setCurrentBulananPage(1);
  }, [
    selected_outlet_bulanan,
    filter_from_bulanan,
    filter_to_bulanan,
    setCurrentBulananPage,
  ]);

  const handle_create = async (new_kunjungan) => {
    const result = await fetch("/api/kunjungan", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_outlet: new_kunjungan.uuid_outlet,
        date: new_kunjungan.date,
        value: new_kunjungan.value,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menyimpan kunjungan.");
    }

    setKunjungan((current) => [payload.data, ...current]);
    toast.success(payload.message || "Kunjungan berhasil ditambahkan.");
  };

  const handle_save = async (next_kunjungan) => {
    const result = await fetch("/api/kunjungan", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_kunjungan: next_kunjungan.uuid,
        uuid_outlet: next_kunjungan.uuid_outlet,
        date: next_kunjungan.date,
        value: next_kunjungan.value,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menyimpan kunjungan.");
    }

    setKunjungan((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Kunjungan berhasil diperbarui.");
  };

  const handle_delete = async () => {
    if (!kunjungan_to_delete) {
      return;
    }

    setIsDeletePending(true);

    try {
      const result = await fetch("/api/kunjungan", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_kunjungan: kunjungan_to_delete.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus kunjungan.");
      }

      setKunjungan((current) =>
        current.filter((item) => item.uuid !== kunjungan_to_delete.uuid),
      );
      setKunjunganToDelete(null);
      toast.success(payload.message || "Kunjungan berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus kunjungan.",
      );
    } finally {
      setIsDeletePending(false);
    }
  };

  const handle_create_bulanan = async (new_kunjungan) => {
    const result = await fetch("/api/kunjungan-bulanan", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_outlet: new_kunjungan.uuid_outlet,
        from_date: new_kunjungan.from_date,
        to_date: new_kunjungan.to_date,
        value: new_kunjungan.value,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menyimpan kunjungan bulanan.");
    }

    setKunjunganBulanan((current) => [payload.data, ...current]);
    toast.success(payload.message || "Kunjungan bulanan berhasil ditambahkan.");
  };

  const handle_save_bulanan = async (next_kunjungan) => {
    const result = await fetch("/api/kunjungan-bulanan", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_kunjungan_bulanan: next_kunjungan.uuid,
        uuid_outlet: next_kunjungan.uuid_outlet,
        from_date: next_kunjungan.from_date,
        to_date: next_kunjungan.to_date,
        value: next_kunjungan.value,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menyimpan kunjungan bulanan.");
    }

    setKunjunganBulanan((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Kunjungan bulanan berhasil diperbarui.");
  };

  const handle_delete_bulanan = async () => {
    if (!kunjungan_bulanan_to_delete) {
      return;
    }

    setIsBulananDeletePending(true);

    try {
      const result = await fetch("/api/kunjungan-bulanan", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_kunjungan_bulanan: kunjungan_bulanan_to_delete.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus kunjungan bulanan.");
      }

      setKunjunganBulanan((current) =>
        current.filter((item) => item.uuid !== kunjungan_bulanan_to_delete.uuid),
      );
      setKunjunganBulananToDelete(null);
      toast.success(payload.message || "Kunjungan bulanan berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus kunjungan bulanan.",
      );
    } finally {
      setIsBulananDeletePending(false);
    }
  };

  const handle_import = async ({ import_date, file }) => {
    try {
      if (!import_date || !file) {
        throw new Error("Tanggal data dan file Excel wajib diisi.");
      }

      setIsImporting(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("import_date", import_date);

      const result = await fetch("/api/kunjungan", {
        method: "POST",
        body: formData,
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal mengimpor kunjungan.");
      }

      const data = await fetch_kunjungan();

      setKunjungan(data.kunjungan);
      setOutlets(data.outlets);
      setIsImportModalOpen(false);
      toast.success(payload.message || "Kunjungan berhasil diimpor.");

      if (Array.isArray(payload.data?.unmatched_outlets) && payload.data.unmatched_outlets.length) {
        toast.warning(
          `${payload.data.unmatched_outlets.length} outlet tidak cocok dengan master outlet.`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengimpor kunjungan.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Kelola data kunjungan kunjungan yang dipakai oleh Nilai Transaksi dan Basket Size."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="harian" className="flex-1 px-4">
              Harian
            </TabsTrigger>
            <TabsTrigger value="bulanan" className="flex-1 px-4">
              Bulanan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="harian">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <CardTitle className="min-w-0 flex-1">Kunjungan Harian</CardTitle>
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                  disabled={is_importing}
                  aria-busy={is_importing}
                >
                  {is_importing ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Mengimpor...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheetIcon className="size-4" />
                      Impor
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <FilterField label="Outlet" className="sm:w-64">
                  <OptionDropdown
                    value={selected_outlet}
                    onValueChange={setSelectedOutlet}
                    options={outlet_filter_options}
                    searchable
                    ariaLabel="Filter outlet kunjungan"
                    searchPlaceholder="Cari outlet..."
                    emptySearchMessage="Outlet tidak ditemukan."
                    triggerClassName="w-full"
                  />
                </FilterField>
                <FilterField label="Tanggal" className="sm:w-44">
                  <Input
                    type="date"
                    value={selected_date}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    aria-label="Filter tanggal kunjungan"
                    className="w-full"
                  />
                </FilterField>
                <div className="flex w-full justify-end sm:ml-auto sm:w-auto sm:items-end">
                  <Button
                    type="button"
                    onClick={() => setIsCreateSheetOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <PlusIcon className="size-4" />
                    Tambah Kunjungan
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[560px] overflow-auto">
                  <Table className="table-fixed">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-20">#</TableHead>
                        <TableHead>
                          <SortableTableHead
                            label="Outlet"
                            sortKey="outlet_name"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead className="w-[180px]">
                          <SortableTableHead
                            label="Kunjungan"
                            sortKey="value"
                            currentSortKey={sort_key}
                            sortDirection={sort_direction}
                            onSort={toggle_sort}
                          />
                        </TableHead>
                        <TableHead className="w-[240px]">
                          <SortableTableHead
                            label="Tanggal"
                            sortKey="date"
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
                          <TableCell className="font-medium">
                            {row.outlet_name}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {Number(row.value ?? 0).toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell>{format_date_label(row.date)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedKunjungan(row);
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
                                onClick={() => setKunjunganToDelete(row)}
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
                    item_label="kunjungan"
                    on_previous={previous_page}
                    on_next={next_page}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="bulanan">
            <Card className="gap-0 border-t-2 border-t-primary/70">
              <CardHeader className="border-b">
                <CardTitle>Kunjungan Bulanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                    <FilterField label="Outlet" className="sm:w-64">
                      <OptionDropdown
                        value={selected_outlet_bulanan}
                        onValueChange={setSelectedOutletBulanan}
                        options={outlet_filter_options}
                        searchable
                        ariaLabel="Filter outlet kunjungan bulanan"
                        searchPlaceholder="Cari outlet..."
                        emptySearchMessage="Outlet tidak ditemukan."
                        triggerClassName="w-full"
                      />
                    </FilterField>
                    <FilterField label="Rentang Tanggal" className="sm:min-w-96">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                        <Input
                          type="date"
                          value={filter_from_bulanan}
                          max={filter_to_bulanan || undefined}
                          onChange={(event) => setFilterFromBulanan(event.target.value)}
                          aria-label="Filter dari kunjungan bulanan"
                          className="w-full"
                        />
                        <div className="flex items-center justify-center text-muted-foreground">
                          <MoveRightIcon className="size-4 rotate-90 sm:rotate-0" />
                          <span className="sr-only">sampai</span>
                        </div>
                        <Input
                          type="date"
                          value={filter_to_bulanan}
                          min={filter_from_bulanan || undefined}
                          onChange={(event) => setFilterToBulanan(event.target.value)}
                          aria-label="Filter sampai kunjungan bulanan"
                          className="w-full"
                        />
                      </div>
                    </FilterField>
                    <div className="flex w-full justify-end sm:ml-auto sm:w-auto sm:items-end">
                      <Button
                        type="button"
                        onClick={() => setIsBulananCreateOpen(true)}
                        className="w-full sm:w-auto"
                      >
                        <PlusIcon className="size-4" />
                        Tambah Kunjungan
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border">
                    <div className="max-h-[560px] overflow-auto">
                      <Table className="table-fixed">
                        <TableHeader className="sticky top-0 z-10 bg-card">
                          <TableRow>
                            <TableHead className="w-20">#</TableHead>
                            <TableHead>
                              <SortableTableHead
                                label="Outlet"
                                sortKey="outlet_name"
                                currentSortKey={sort_bulanan_key}
                                sortDirection={sort_bulanan_direction}
                                onSort={toggle_bulanan_sort}
                              />
                            </TableHead>
                            <TableHead className="w-[160px]">
                              <SortableTableHead
                                label="Kunjungan"
                                sortKey="value"
                                currentSortKey={sort_bulanan_key}
                                sortDirection={sort_bulanan_direction}
                                onSort={toggle_bulanan_sort}
                              />
                            </TableHead>
                            <TableHead className="w-[200px]">
                              <SortableTableHead
                                label="Dari"
                                sortKey="from_date"
                                currentSortKey={sort_bulanan_key}
                                sortDirection={sort_bulanan_direction}
                                onSort={toggle_bulanan_sort}
                              />
                            </TableHead>
                            <TableHead className="w-[200px]">
                              <SortableTableHead
                                label="Sampai"
                                sortKey="to_date"
                                currentSortKey={sort_bulanan_key}
                                sortDirection={sort_bulanan_direction}
                                onSort={toggle_bulanan_sort}
                              />
                            </TableHead>
                            <TableHead className="w-[180px]">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginated_bulanan_rows.map((row, index) => (
                            <TableRow key={row.uuid}>
                              <TableCell>
                                {(current_bulanan_page - 1) * PAGE_SIZE + index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {row.outlet_name}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {Number(row.value ?? 0).toLocaleString("id-ID")}
                              </TableCell>
                              <TableCell>{format_date_label(row.from_date)}</TableCell>
                              <TableCell>{format_date_label(row.to_date)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedKunjunganBulanan(row);
                                      setIsBulananSheetOpen(true);
                                    }}
                                  >
                                    <PencilIcon className="size-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="delete"
                                    size="sm"
                                    onClick={() => setKunjunganBulananToDelete(row)}
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

                    {filtered_bulanan_items.length === 0 ? (
                      <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                        Data tidak tersedia.
                      </div>
                    ) : (
                      <Pagination
                        current_page={current_bulanan_page}
                        page_size={PAGE_SIZE}
                        total_items={filtered_bulanan_items.length}
                        total_pages={total_bulanan_pages}
                        item_label="kunjungan"
                        on_previous={previous_bulanan_page}
                        on_next={next_bulanan_page}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <KunjunganSheet
        key={`kunjungan-edit-${selected_kunjungan?.uuid ?? "closed"}`}
        open={is_sheet_open}
        title="Edit Kunjungan"
        item={selected_kunjungan}
        outlets={outlets}
        on_open_change={(open) => {
          setIsSheetOpen(open);

          if (!open) {
            setSelectedKunjungan(null);
          }
        }}
        on_save={handle_save}
      />

      <KunjunganSheet
        key={`kunjungan-create-${is_create_sheet_open ? "open" : "closed"}`}
        open={is_create_sheet_open}
        title="Tambah Kunjungan"
        item={{
          uuid_outlet: "",
          date: new Date().toISOString().slice(0, 10),
          value: "",
        }}
        outlets={outlets}
        on_open_change={setIsCreateSheetOpen}
        on_save={handle_create}
      />

      {is_import_modal_open ? (
        <ImportDataModal
          default_date={new Date().toISOString().slice(0, 10)}
          import_type="kunjungan"
          is_importing={is_importing}
          on_open_change={setIsImportModalOpen}
          on_submit={handle_import}
        />
      ) : null}

      <ConfirmActionDialog
        open={Boolean(kunjungan_to_delete)}
        onOpenChange={(open) => {
          if (!open) {
            setKunjunganToDelete(null);
          }
        }}
        title="Hapus kunjungan"
        description={`Kunjungan "${kunjungan_to_delete?.outlet_name ?? "-"}" pada ${kunjungan_to_delete?.date ?? "-"} akan disembunyikan dari data aktif.`}
        confirmLabel="Ya, hapus"
        confirmVariant="delete"
        isPending={is_delete_pending}
        onConfirm={handle_delete}
      />

      <KunjunganBulananSheet
        key={`kunjungan-bulanan-edit-${selected_kunjungan_bulanan?.uuid ?? "closed"}`}
        open={is_bulanan_sheet_open}
        title="Edit Kunjungan Bulanan"
        item={selected_kunjungan_bulanan}
        outlets={outlets}
        on_open_change={(open) => {
          setIsBulananSheetOpen(open);

          if (!open) {
            setSelectedKunjunganBulanan(null);
          }
        }}
        on_save={handle_save_bulanan}
      />

      <KunjunganBulananSheet
        key={`kunjungan-bulanan-create-${is_bulanan_create_open ? "open" : "closed"}`}
        open={is_bulanan_create_open}
        title="Tambah Kunjungan Bulanan"
        item={{
          uuid_outlet: "",
          from_date: first_day_of_month_value(),
          to_date: new Date().toISOString().slice(0, 10),
          value: "",
        }}
        outlets={outlets}
        on_open_change={setIsBulananCreateOpen}
        on_save={handle_create_bulanan}
      />

      <ConfirmActionDialog
        open={Boolean(kunjungan_bulanan_to_delete)}
        onOpenChange={(open) => {
          if (!open) {
            setKunjunganBulananToDelete(null);
          }
        }}
        title="Hapus kunjungan bulanan"
        description={`Kunjungan bulanan "${kunjungan_bulanan_to_delete?.outlet_name ?? "-"}" ${kunjungan_bulanan_to_delete?.from_date ?? "-"} sampai ${kunjungan_bulanan_to_delete?.to_date ?? "-"} akan disembunyikan dari data aktif.`}
        confirmLabel="Ya, hapus"
        confirmVariant="delete"
        isPending={is_bulanan_delete_pending}
        onConfirm={handle_delete_bulanan}
      />
    </>
  );
}
