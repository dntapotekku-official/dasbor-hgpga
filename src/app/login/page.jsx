"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [is_loading, setIsLoading] = useState(false);

  const loginHandler = async (event) => {
    event.preventDefault();

    try {
      setIsLoading(true);

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Login gagal.");
      }

      toast.success("Login berhasil.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Terjadi kesalahan saat login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-svh grid-rows-[1fr_auto] bg-primary px-6 py-4">
      <div className="flex items-center justify-center py-2">
        <Card className="w-full max-w-sm border-white/20 bg-card/98 shadow-2xl ring-white/20">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex w-fit max-w-full justify-self-center rounded-2xl border border-primary/30 bg-primary p-3 shadow-md ring-1 ring-primary/10">
            <Image
              src="/apotekku-logo-crop.png"
              alt="HGPGA"
              width={120}
              height={83}
              className="h-auto w-[128px] object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold my-2">Dasbor HGPGA</CardTitle>
            <CardDescription>
              Silahkan Masuk
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={loginHandler}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="bg-background"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="bg-background"
                required
              />
            </div>
            <Button className="w-full shadow-sm" type="submit" disabled={is_loading}>
              {is_loading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
          <CardDescription className="mt-3 text-center">
            Lupa kata sandi? hubungi administrator.
          </CardDescription>
        </CardContent>
        </Card>
      </div>
      <footer className="pt-3 text-center text-xs text-white/75">
        Dikembangkan oleh <span className="font-semibold"> Tim DnT ApotekKu.</span>
      </footer>
    </main>
  );
}
