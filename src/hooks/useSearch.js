"use client";

import { useMemo, useState } from "react";

export default function useSearch(items, search_fields) {
  const [search, setSearch] = useState("");

  const filtered_items = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return items;
    }

    return items.filter((item) =>
      search_fields.some((field) => {
        const value = item?.[field];
        const values = Array.isArray(value) ? value : [value];

        return values.some((entry) =>
          String(entry ?? "").toLowerCase().includes(keyword),
        );
      }),
    );
  }, [items, search, search_fields]);

  return {
    search,
    setSearch,
    filtered_items,
  };
}
