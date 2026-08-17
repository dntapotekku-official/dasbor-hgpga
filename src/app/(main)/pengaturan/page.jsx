"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import OutletTable from "./components/outlet-table";
import KaryawanTable from "./components/karyawan-table";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

async function fetchOutletKaryawan() {
  const result = await fetch("/api/outlet-karyawan");
  const data = await result.json();

  if (!result.ok || !data.success) {
    throw new Error(data.message || "Gagal mengambil data outlet dan karyawan.");
  }

  return {
    outlet: data.data.data_outlet,
    karyawan: data.data.data_karyawan,
  };
}

export default function PengaturanPage() {
  const [sync_status, setSyncStatus] = useState("idle");
  const [outlet, setOutlet] = useState([]);
  const [karyawan, setKaryawan] = useState([]);

  useEffect(() => {
    let should_ignore = false;

    async function loadOutletKaryawan() {
      try {
        const data = await fetchOutletKaryawan();

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
              : "Gagal mengambil data outlet dan karyawan.",
          );
        }
      }
    }

    void loadOutletKaryawan();

    return () => {
      should_ignore = true;
    };
  }, []);

  const syncOutletKaryawanHandler = async () => {
    try {
      setSyncStatus("loading");

      const result = await fetch("/api/outlet-karyawan", {
        method: "POST",
      });
      const data = await result.json();

      if (!result.ok || !data.success) {
        throw new Error(data.message || "Sinkronisasi gagal dijalankan.");
      }

      const latest_data = await fetchOutletKaryawan();

      setOutlet(latest_data.outlet);
      setKaryawan(latest_data.karyawan);
      toast.success("Sinkronisasi data outlet dan karyawan berhasil.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat sinkronisasi.",
      );
    } finally {
      setSyncStatus("idle");
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Sinkronkan dan pantau data outlet serta karyawan."
          action={
            <Button
              type="button"
              onClick={syncOutletKaryawanHandler}
              disabled={sync_status === "loading"}
            >
              {sync_status === "loading" ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Menyinkronkan...
                </>
              ) : (
                "Sinkron"
              )}
            </Button>
          }
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Data Outlet & Karyawan</CardTitle>
            <CardDescription>
              Kelola data master yang dipakai oleh fitur HGPGA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="outlet">
              <TabsList>
                <TabsTrigger value="outlet">Outlet</TabsTrigger>
                <TabsTrigger value="karyawan">Karyawan</TabsTrigger>
              </TabsList>
              <TabsContent value="outlet" className="mt-4">
                <OutletTable data={outlet} />
              </TabsContent>
              <TabsContent value="karyawan" className="mt-4">
                <KaryawanTable data={karyawan} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
