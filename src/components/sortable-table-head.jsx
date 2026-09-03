"use client";

import { ChevronsUpDownIcon } from "lucide-react";

export default function SortableTableHead({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className = "",
  buttonClassName = "",
}) {
  const is_active = currentSortKey === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex w-full cursor-pointer items-center gap-2 text-left font-medium ${buttonClassName}`}
    >
      {label}
      <ChevronsUpDownIcon
        className={`size-4 shrink-0 text-primary-foreground/90 ${className}`}
      />
    </button>
  );
}
