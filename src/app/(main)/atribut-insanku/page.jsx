"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AtributInsankuPage() {
  const { user, role } = useAuth();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [is_submitting, setIsSubmitting] = useState(false);

  const is_member = role === "member";

  const update_form = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const reset_form = () => {
    setForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
  };

  const handle_submit = async (event) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal memperbarui password.");
      }

      reset_form();
      toast.success(payload.message || "Password berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Atribut InsanKu"
          description="Kelola data akun dan keamanan akses Anda."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="border-b">
            <CardTitle>Ubah Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CardDescription>
              {is_member
                ? "Karyawan dapat mengganti password akun sendiri di halaman ini."
                : "Halaman ini digunakan karyawan untuk mengganti password akun mereka sendiri."}
            </CardDescription>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{user?.name ?? "-"}</p>
              <p className="text-muted-foreground">{user?.username ?? "-"}</p>
            </div>
            {is_member ? (
              <form className="space-y-4" onSubmit={handle_submit}>
                <div className="space-y-2">
                  <Label htmlFor="current_password">Password Saat Ini</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={form.current_password}
                    onChange={(event) =>
                      update_form("current_password", event.target.value)
                    }
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_password">Password Baru</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={form.new_password}
                    onChange={(event) => update_form("new_password", event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={form.confirm_password}
                    onChange={(event) =>
                      update_form("confirm_password", event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" disabled={is_submitting}>
                  {is_submitting ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Password"
                  )}
                </Button>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Form ubah password khusus ditampilkan untuk akun karyawan yang sedang login.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
