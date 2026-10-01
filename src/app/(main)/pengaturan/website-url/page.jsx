"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import FieldLabel from "@/components/field-label";
import PageHeading from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const website_fields = [
  {
    key: "lms",
    label: "LMS",
    placeholder: "https://lms.apotekkuapp.com",
  },
  {
    key: "audit",
    label: "Audit",
    placeholder: "https://audit.apotekkuapp.com",
  },
  {
    key: "slipgaji",
    label: "Slip Gaji",
    placeholder: "https://slipgaji.apotekkuapp.com",
  },
];

const create_initial_urls = () =>
  Object.fromEntries(website_fields.map((item) => [item.key, ""]));

export default function WebsiteUrlSettingsPage() {
  const [urls, setUrls] = useState(create_initial_urls);
  const [is_loading, setIsLoading] = useState(true);
  const [is_saving, setIsSaving] = useState(false);
  const save_lock_ref = useRef(false);

  useEffect(() => {
    const load_settings = async () => {
      try {
        const result = await fetch("/api/website-url");
        const payload = await result.json();

        if (!result.ok || !payload.success) {
          throw new Error(payload.message || "Gagal memuat URL website.");
        }

        const next_urls = create_initial_urls();

        for (const item of payload.data ?? []) {
          if (item?.key in next_urls) {
            next_urls[item.key] = item.url ?? "";
          }
        }

        setUrls(next_urls);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat URL website.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load_settings();
  }, []);

  const handle_submit = async (event) => {
    event.preventDefault();

    if (save_lock_ref.current) {
      return;
    }

    save_lock_ref.current = true;
    setIsSaving(true);

    try {
      const result = await fetch("/api/website-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: website_fields.map((field) => ({
            key: field.key,
            url: urls[field.key] ?? "",
          })),
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menyimpan URL website.");
      }

      const next_urls = create_initial_urls();

      for (const item of payload.data ?? []) {
        if (item?.key in next_urls) {
          next_urls[item.key] = item.url ?? "";
        }
      }

      setUrls(next_urls);
      toast.success(payload.message || "URL website berhasil disimpan.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan URL website.",
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
          description="Kelola URL website eksternal yang terhubung dengan laporan."
        />
      </div>
      <div className="px-4 lg:px-6">
        <Card className="gap-0 border-t-2 border-t-primary/70">
          <CardHeader className="border-b">
            <CardTitle>URL Website</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handle_submit} className="max-w-3xl space-y-5">
              {website_fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <FieldLabel htmlFor={`website-url-${field.key}`} label={field.label} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id={`website-url-${field.key}`}
                      value={urls[field.key] ?? ""}
                      onChange={(event) =>
                        setUrls((current_urls) => ({
                          ...current_urls,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      disabled={is_loading}
                    />
                    {urls[field.key] ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        render={
                          <a
                            href={urls[field.key]}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ExternalLinkIcon className="size-4" />
                        Buka
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={is_loading || is_saving}
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
