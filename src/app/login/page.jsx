"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <Image
              src="/apotekku-logo.jpeg"
              alt="HGPGA"
              width={220}
              height={154}
              className="h-20 w-auto object-contain"
              priority
            />
          </div>
          <CardTitle>Login</CardTitle>
          <CardDescription>Masuk untuk mengakses Dasbor HGPGA.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={loginHandler}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={is_loading}>
              {is_loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
