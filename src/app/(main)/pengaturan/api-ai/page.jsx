"use client";

import { useEffect, useRef, useState } from "react";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PenjualanGofitkuTab from "./components/penjualan-gofitku-tab";

export default function AiApiPage() {
  const prompt_key = "penjualan_gofitku";
  const [base_url, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [api_key, setApiKey] = useState("");
  const [prompt_penjualan_gofitku, setPromptPenjualanGofitku] = useState("");
  const [show_api_key, setShowApiKey] = useState(false);
  const [is_saving, setIsSaving] = useState(false);
  const save_lock_ref = useRef(false);

  useEffect(() => {
    const load_settings = async () => {
      try {
        const result = await fetch("/api/api-ai");
        const payload = await result.json();

        if (!result.ok || !payload.success || !payload.data) {
          toast.error(payload.message || "Gagal memuat pengaturan AI API.");
          return;
        }

        setBaseUrl(payload.data.api_ai?.base_url ?? "");
        setModel(payload.data.api_ai?.model ?? "");
        const current_prompt = (payload.data.prompts ?? []).find(
          (item) => item.name === prompt_key,
        );

        setPromptPenjualanGofitku(current_prompt?.prompt ?? "");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat pengaturan AI API.",
        );
      }
    };

    load_settings();
  }, []);

  const handle_submit = async (event) => {
    event.preventDefault();

    if (save_lock_ref.current) {
      return;
    }

    save_lock_ref.current = true;
    setIsSaving(true);

    try {
      const result = await fetch("/api/api-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_url: base_url,
          model: model,
          api_key: api_key,
          prompts: [
            {
              name: prompt_key,
              prompt: prompt_penjualan_gofitku,
            },
          ],
        }),
      });

      const payload = await result.json();

      if (!result.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "Gagal menyimpan data API AI.");
      }

      toast.success(payload.message || "Data API AI berhasil disimpan.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan data API AI.",
      );
    } finally {
      save_lock_ref.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Sinkronkan dan pantau data outlet, InsanKu, dan admin, serta kelola pengaturan sistem lainnya."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>API AI</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handle_submit} className="max-w-3xl space-y-5">
              <div className="space-y-2">
                <Label htmlFor="base_url">Base URL</Label>
                <Input
                  id="base_url"
                  value={base_url}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://ai.sumopod.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="gpt-5-mini"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API KEY</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Input
                      id="api_key"
                      type={show_api_key ? "text" : "password"}
                      value={api_key}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="sk-xxxxxxxxxxxxxxxxxxx"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((current) => !current)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={show_api_key ? "Sembunyikan API KEY" : "Tampilkan API KEY"}
                    >
                      {show_api_key ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  API KEY yang tersimpan tidak dapat dilihat kembali.
                </p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Prompt</Label>

                <PenjualanGofitkuTab
                  value={prompt_penjualan_gofitku}
                  onChange={setPromptPenjualanGofitku}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={is_saving}
                  aria-busy={is_saving}
                >
                  {is_saving ? (
                    <>
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
