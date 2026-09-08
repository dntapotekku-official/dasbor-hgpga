"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react";

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
  const SortIcon = !is_active
    ? ChevronsUpDownIcon
    : sortDirection === "asc"
      ? ChevronUpIcon
      : ChevronDownIcon;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Urutkan ${label} ${is_active && sortDirection === "asc" ? "menurun" : "menaik"}`}
      className={`flex w-full cursor-pointer items-center gap-2 text-left font-medium ${buttonClassName}`}
    >
      {label}
      <SortIcon
        className={`size-4 shrink-0 text-primary-foreground/90 ${className}`}
      />
    </button>
  );
}
