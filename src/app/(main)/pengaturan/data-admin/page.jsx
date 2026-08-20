"use client";

import { useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";
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

export default function DataAdminPage() {
  const [admin, setAdmin] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(admin);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(filtered_items, PAGE_SIZE);

  const fetch_admin = async () => {
    const result = await fetch("/api/admin");
    const data = await result.json();

    if (!result.ok || !data.success) {
      throw new Error(data.message || "Gagal mengambil data admin.");
    }

    return {
      admin: data.data.data_admin,
    };
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_admin() {
      try {
        const data = await fetch_admin();

        if (should_ignore) {
          return;
        }

        setAdmin(data.admin);
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
          <CardHeader>
            <CardTitle>Data Admin</CardTitle>
            <CardDescription>
              Kelola akun admin yang dapat mengakses dasbor HGPGA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari admin..."
                  className="max-w-sm"
                />
                <Button
                  type="button"
                  onClick={() => setIsCreateSheetOpen(true)}
                  className="w-full sm:w-auto"
                >
                  Tambah Admin
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-20">#</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-28 text-right">Aksi</TableHead>
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
                          <TableCell>{row.role}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAdmin(row);
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
                key={selectedAdmin?.uuid ?? "admin-sheet"}
                open={isSheetOpen}
                on_open_change={setIsSheetOpen}
                title="Edit Admin"
                description="Perbarui data admin pada tampilan pengaturan."
                item={selectedAdmin}
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
                    options: [
                      { value: "admin", label: "Admin" },
                      { value: "viewer", label: "Viewer" },
                    ],
                  },
                ]}
                on_save={handle_save}
              />

              <PengaturanRowSheet
                key="admin-create-sheet"
                open={isCreateSheetOpen}
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
                    options: [
                      { value: "admin", label: "Admin" },
                      { value: "viewer", label: "Viewer" },
                    ],
                  },
                ]}
                on_save={handle_create}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
