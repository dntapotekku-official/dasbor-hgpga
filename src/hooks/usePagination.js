"use client";

import { useMemo, useState } from "react";

export default function usePagination(items, page_size) {
  const [current_page, setCurrentPage] = useState(1);
  const safe_items = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const total_pages = Math.max(1, Math.ceil(safe_items.length / page_size));

  const paginated_rows = useMemo(
    () =>
      safe_items.slice(
        (current_page - 1) * page_size,
        current_page * page_size,
      ),
    [current_page, safe_items, page_size],
  );

  const previous_page = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const next_page = () => {
    setCurrentPage((page) => Math.min(total_pages, page + 1));
  };

  return {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  };
}
