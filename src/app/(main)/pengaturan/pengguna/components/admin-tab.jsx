"use client";

import { useEffect, useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import Pagination from "@/components/pagination";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import { hasRoleAccess, isSuperadmin } from "@/lib/role";
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

export default function AdminTab() {
  const { role } = useAuth();
  const [admin, setAdmin] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(admin);
  const [selected_admin, setSelectedAdmin] = useState(null);
  const [deleting_admin, setDeletingAdmin] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [is_deleting_admin, setIsDeletingAdmin] = useState(false);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(filtered_items, PAGE_SIZE);

  const format_role_label = (value) => {
    const normalized_role = String(value ?? "").trim().toLowerCase();

    if (!normalized_role) {
      return "-";
    }

    return normalized_role.charAt(0).toUpperCase() + normalized_role.slice(1);
  };

  const admin_role_options = hasRoleAccess(role, ["superadmin"])
    ? [
        { value: "superadmin", label: "Superadmin" },
        { value: "admin", label: "Admin" },
        { value: "viewer", label: "Viewer" },
      ]
    : [
        { value: "admin", label: "Admin" },
        { value: "viewer", label: "Viewer" },
      ];

  const can_delete_admin = (row) => {
    if (!row) {
      return false;
    }

    if (isSuperadmin(row.role) && !hasRoleAccess(role, ["superadmin"])) {
      return false;
    }

    return true;
  };

  const can_edit_admin = (row) => {
    if (!row) {
      return false;
    }

    if (isSuperadmin(row.role) && !hasRoleAccess(role, ["superadmin"])) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_admin() {
      try {
        const result = await fetch("/api/admin");
        const data = await result.json();

        if (!result.ok || !data.success) {
          throw new Error(data.message || "Gagal mengambil data admin.");
        }

        if (should_ignore) {
          return;
        }

        setAdmin(data.data.data_admin);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data admin.",
          );
        }
      }
    }

    void load_admin();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const handle_save = async (next_admin) => {
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_admin: next_admin.uuid,
        name: next_admin.name,
        username: next_admin.username,
        role: next_admin.role,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data admin.");
    }

    setAdmin((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );
    toast.success(payload.message || "Data admin berhasil diperbarui.");
  };

  const handle_create = async (new_admin) => {
    const response = await fetch("/api/admin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: new_admin.name,
        username: new_admin.username,
        password: new_admin.password,
        role: new_admin.role,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menambahkan admin.");
    }

    setAdmin((current) => [payload.data, ...current]);
    toast.success(payload.message || "Admin berhasil ditambahkan.");
  };

  const handle_delete = async () => {
    if (!deleting_admin) {
      return;
    }

    try {
      setIsDeletingAdmin(true);

      const response = await fetch("/api/admin", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_admin: deleting_admin.uuid,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus admin.");
      }

      setAdmin((current) =>
        current.filter((item) => item.uuid !== deleting_admin.uuid),
      );
      setDeletingAdmin(null);
      toast.success(payload.message || "Data admin berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus admin.",
      );
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  return (
    <Card className="gap-0 border-t-4 border-t-primary">
      <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Admin</CardTitle>
        <Button
          type="button"
          onClick={() => setIsCreateSheetOpen(true)}
          className="w-full sm:w-auto"
        >
          Tambah Admin
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari admin..."
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
                    <TableHead>Role</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated_rows.map((row, index) => (
                    <TableRow key={row.uuid}>
                      <TableCell>{(current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{format_role_label(row.role)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAdmin(row);
                              setIsSheetOpen(true);
                            }}
                            disabled={!can_edit_admin(row)}
                          >
                            <PencilIcon className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="delete"
                            size="sm"
                            onClick={() => setDeletingAdmin(row)}
                            disabled={!can_delete_admin(row)}
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
                Tidak ada admin yang cocok dengan pencarian.
              </div>
            ) : (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={filtered_items.length}
                total_pages={total_pages}
                item_label="admin"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>

          <PengaturanRowSheet
            key={selected_admin?.uuid ?? "admin-sheet"}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title="Edit Admin"
            description="Perbarui data admin pada tampilan pengaturan."
            item={selected_admin}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama admin",
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              {
                key: "role",
                label: "Role",
                type: "select",
                placeholder: "Pilih role",
                options: admin_role_options,
              },
            ]}
            on_save={handle_save}
          />

          <PengaturanRowSheet
            key="admin-create-sheet"
            open={is_create_sheet_open}
            on_open_change={setIsCreateSheetOpen}
            title="Tambah Admin"
            description="Tambahkan data admin baru ke database."
            item={{
              name: "",
              username: "",
              password: "",
              role: "admin",
            }}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama admin",
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              {
                key: "password",
                label: "Password",
                placeholder: "Masukkan password",
              },
              {
                key: "role",
                label: "Role",
                type: "select",
                placeholder: "Pilih role",
                options: admin_role_options,
              },
            ]}
            on_save={handle_create}
          />

          <ConfirmActionDialog
            open={Boolean(deleting_admin)}
            onOpenChange={(next_open) => {
              if (!next_open && !is_deleting_admin) {
                setDeletingAdmin(null);
              }
            }}
            title="Hapus Admin"
            description={`Akun ${deleting_admin?.name ?? ""} akan dihapus dari daftar admin.`}
            confirmLabel="Ya, hapus"
            confirmVariant="delete"
            onConfirm={handle_delete}
            isPending={is_deleting_admin}
          />
        </div>
      </CardContent>
    </Card>
  );
}
