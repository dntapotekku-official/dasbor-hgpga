"use client";

import { useMemo, useState } from "react";

export default function usePagination(items, page_size) {
  const [current_page, setCurrentPage] = useState(1);
  const safe_items = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const total_pages = Math.max(1, Math.ceil(safe_items.length / page_size));
  const effective_current_page = Math.min(current_page, total_pages);

  const paginated_rows = useMemo(
    () =>
      safe_items.slice(
        (effective_current_page - 1) * page_size,
        effective_current_page * page_size,
      ),
    [effective_current_page, safe_items, page_size],
  );

  const previous_page = () => {
    setCurrentPage((page) => Math.max(1, Math.min(page, total_pages) - 1));
  };

  const next_page = () => {
    setCurrentPage((page) => Math.min(total_pages, Math.min(page, total_pages) + 1));
  };

  return {
    current_page: effective_current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  };
}
