"use client";

import { Button } from "@/components/ui/button";

export default function Pagination({
  current_page,
  page_size,
  total_items,
  total_pages,
  item_label,
  on_previous,
  on_next,
}) {
  const start_item = (current_page - 1) * page_size + 1;
  const end_item = Math.min(current_page * page_size, total_items);

  return (
    <div className="flex flex-col gap-2.5 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Menampilkan{" "}
        <span className="font-medium text-foreground">{start_item}</span> -{" "}
        <span className="font-medium text-foreground">{end_item}</span> dari{" "}
        <span className="font-medium text-foreground">{total_items}</span>{" "}
        {item_label}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={on_previous}
          disabled={current_page === 1}
        >
          Sebelumnya
        </Button>
        <span className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
          {current_page} / {total_pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={on_next}
          disabled={current_page === total_pages}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
