"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function WebsiteLinkButton({
  websiteKey,
  className = "",
  label = "Menuju Website",
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let is_active = true;

    const load_url = async () => {
      try {
        const result = await fetch(
          `/api/website-url?key=${encodeURIComponent(websiteKey)}`,
        );
        const payload = await result.json();

        if (!is_active || !result.ok || !payload.success) {
          return;
        }

        setUrl(payload.data?.[0]?.url ?? "");
      } catch {
        if (is_active) {
          setUrl("");
        }
      }
    };

    if (websiteKey) {
      void load_url();
    }

    return () => {
      is_active = false;
    };
  }, [websiteKey]);

  if (!url) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled
      >
        <ExternalLinkIcon className="size-4" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      render={<a href={url} target="_blank" rel="noreferrer" />}
    >
      <ExternalLinkIcon className="size-4" />
      {label}
    </Button>
  );
}
