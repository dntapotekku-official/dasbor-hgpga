"use client";

import { useMemo, useState } from "react";

export default function useSearch(items) {
  const [search, setSearch] = useState("");

  const filtered_items = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return items;
    }

    return items.filter((item) =>
      Object.values(item).some((value) =>
        String(value).toLowerCase().includes(keyword),
      ),
    );
  }, [items, search]);

  return {
    search,
    setSearch,
    filtered_items,
  };
}
