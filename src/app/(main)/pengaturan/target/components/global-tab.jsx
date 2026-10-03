"use client";

import { useEffect, useState } from "react";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import ConfirmActionDialog from "@/components/confirm-action-dialog";
import CurrencyValue from "@/components/currency-value";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PengaturanRowSheet from "../../component/pengaturan-row-sheet";

const target_config = {
  nilai_transaksi: {
    label: "Nilai Transaksi",
    description: "Kelola target global Nilai Transaksi berdasarkan rentang tanggal.",
    value_format: "raw",
    placeholder: "Contoh: 105000.125",
    helper: "Gunakan angka asli sesuai kebutuhan.",
  },
  basket_size: {
    label: "Basket Size",
    description: "Kelola target global Basket Size berdasarkan rentang tanggal.",
    value_format: "decimal",
    placeholder: "Contoh: 2,08",
    helper: "Gunakan angka asli sesuai kebutuhan, misalnya 2,0875.",
  },
};

async function read_json_response(response) {
  const response_text = await response.text();

  if (!response_text.trim()) {
    return {};
  }

  try {
    return JSON.parse(response_text);
  } catch {
    throw new Error("Respons server tidak valid. Silakan muat ulang halaman dan coba lagi.");
  }
}

function format_target_date(value) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function format_target_range(start_date, end_date) {
  const start_label = format_target_date(start_date);

  if (!end_date) {
    return `${start_label} - seterusnya`;
  }

  const end_label = format_target_date(end_date);

  return start_date === end_date ? start_label : `${start_label} - ${end_label}`;
}

function GlobalTargetTable({ metric_key }) {
  const config = target_config[metric_key];
  const [rows, setRows] = useState([]);
  const [is_loading, setIsLoading] = useState(true);
  const [selected_target, setSelectedTarget] = useState(null);
  const [is_edit_open, setIsEditOpen] = useState(false);
  const [is_create_open, setIsCreateOpen] = useState(false);
  const [target_to_delete, setTargetToDelete] = useState(null);
  const [is_delete_pending, setIsDeletePending] = useState(false);

  useEffect(() => {
    let should_ignore = false;

    async function load_rows() {
      try {
        const response = await fetch(
          `/api/target-global?key=${encodeURIComponent(metric_key)}`,
          { cache: "no-store" },
        );
        const payload = await read_json_response(response);

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || `Gagal mengambil target global ${config.label}.`);
        }

        if (!should_ignore) {
          setRows(payload.data?.items ?? []);
        }
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : `Gagal mengambil target global ${config.label}.`,
          );
        }
      } finally {
        if (!should_ignore) {
          setIsLoading(false);
        }
      }
    }

    void load_rows();

    return () => {
      should_ignore = true;
    };
  }, [config.label, metric_key]);

  const fields = [
    {
      key: "start_date",
      label: "Tanggal Mulai",
      type: "date",
      required: true,
    },
    {
      key: "end_date",
      label: "Tanggal Selesai",
      type: "date",
      required: true,
    },
    {
      key: "target",
      label: "Target",
      type: config.value_format === "currency" ? "currency" : "number",
      input_type: "number",
      placeholder: config.placeholder,
      helper: config.helper,
      step: "any",
      required: true,
    },
  ];

  const handle_create = async (new_target) => {
    const response = await fetch("/api/target-global", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: metric_key, ...new_target }),
    });
    const payload = await read_json_response(response);

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || `Gagal menambahkan target global ${config.label}.`);
    }

    setRows((current) => [payload.data, ...current]);
    toast.success(payload.message || `Target global ${config.label} berhasil ditambahkan.`);
  };

  const handle_update = async (next_target) => {
    const response = await fetch("/api/target-global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uuid_target_global: next_target.uuid,
        key: metric_key,
        target: next_target.target,
        start_date: next_target.start_date,
        end_date: next_target.end_date,
      }),
    });
    const payload = await read_json_response(response);

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || `Gagal memperbarui target global ${config.label}.`);
    }

    setRows((current) =>
      current
        .map((item) => (item.uuid === payload.data.uuid ? payload.data : item))
        .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date))),
    );
    toast.success(payload.message || `Target global ${config.label} berhasil diperbarui.`);
  };

  const handle_delete = async () => {
    if (!target_to_delete) {
      return;
    }

    setIsDeletePending(true);

    try {
      const response = await fetch("/api/target-global", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid_target_global: target_to_delete.uuid }),
      });
      const payload = await read_json_response(response);

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || `Gagal menghapus target global ${config.label}.`);
      }

      setRows((current) => current.filter((item) => item.uuid !== target_to_delete.uuid));
      setTargetToDelete(null);
      toast.success(payload.message || `Target global ${config.label} berhasil dihapus.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Gagal menghapus target global ${config.label}.`,
      );
    } finally {
      setIsDeletePending(false);
    }
  };

  const format_target_value = (value) => {
    if (config.value_format === "currency") {
      return <CurrencyValue value={value} align="left" />;
    }

    const parsed_value = Number(value ?? 0);

    return Number.isFinite(parsed_value)
      ? parsed_value.toLocaleString("id-ID", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0,00";
  };

  return (
    <Card className="border-t-2 border-t-primary/70">
      <CardHeader className="border-b">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>Target Global {config.label}</CardTitle>
            <CardDescription className="mt-1">{config.description}</CardDescription>
          </div>
          <Button type="button" className="shrink-0" onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="size-4" />
            Tambah Target
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <div className="max-h-[560px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Rentang Tanggal</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-[180px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.uuid}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {format_target_range(row.start_date, row.end_date)}
                    </TableCell>
                    <TableCell>{format_target_value(row.target)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTarget(row);
                            setIsEditOpen(true);
                          }}
                        >
                          <PencilIcon className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="delete"
                          size="sm"
                          onClick={() => setTargetToDelete(row)}
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

          {is_loading ? (
            <div className="flex items-center justify-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Memuat target...
            </div>
          ) : rows.length === 0 ? (
            <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada target global {config.label}.
            </div>
          ) : null}
        </div>
      </CardContent>

      <PengaturanRowSheet
        key={selected_target?.uuid ?? `${metric_key}-edit`}
        open={is_edit_open}
        on_open_change={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setSelectedTarget(null);
          }
        }}
        title={`Edit Target Global ${config.label}`}
        description={`Perbarui nilai dan rentang target global ${config.label}.`}
        item={selected_target}
        fields={fields}
        on_save={handle_update}
      />

      <PengaturanRowSheet
        key={`${metric_key}-create`}
        open={is_create_open}
        on_open_change={setIsCreateOpen}
        title={`Tambah Target Global ${config.label}`}
        description={`Tambahkan nilai dan rentang target global ${config.label}.`}
        item={{ start_date: "", end_date: "", target: "" }}
        fields={fields}
        on_save={handle_create}
      />

      <ConfirmActionDialog
        open={Boolean(target_to_delete)}
        onOpenChange={(open) => {
          if (!open) {
            setTargetToDelete(null);
          }
        }}
        title={`Hapus Target Global ${config.label}`}
        description={`Target periode ${
          target_to_delete
            ? format_target_range(target_to_delete.start_date, target_to_delete.end_date)
            : "-"
        } akan dihapus.`}
        confirmLabel="Ya, hapus"
        confirmVariant="delete"
        isPending={is_delete_pending}
        onConfirm={handle_delete}
      />
    </Card>
  );
}

export default function GlobalTab() {
  const [active_target, setActiveTarget] = useState("nilai_transaksi");

  return (
    <div className="space-y-6">
      <Tabs value={active_target} onValueChange={setActiveTarget}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
          {Object.entries(target_config).map(([key, item]) => (
            <TabsTrigger key={key} value={key} className="min-w-max px-4 py-2">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <GlobalTargetTable key={active_target} metric_key={active_target} />
    </div>
  );
}
