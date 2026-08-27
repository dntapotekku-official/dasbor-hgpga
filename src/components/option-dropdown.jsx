"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function OptionDropdown({
  id,
  value,
  options,
  onValueChange,
  ariaLabel,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Cari...",
  emptyMessage = "Data tidak ditemukan.",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected_label = options.find((option) => option.value === value)?.label ?? "Pilih";
  const filtered_options = useMemo(() => {
    const normalized_search = search.trim().toLowerCase();

    if (!searchable || !normalized_search) {
      return options;
    }

    return options.filter((option) =>
      String(option.label ?? "").trim().toLowerCase().includes(normalized_search),
    );
  }, [options, search, searchable]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next_open) => {
        setOpen(next_open);

        if (!next_open) {
          setSearch("");
        }
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            disabled={disabled}
            className="w-full justify-between bg-card"
          />
        }
      >
        <span className="truncate">{selected_label}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {searchable ? (
          <div className="relative p-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        ) : null}
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next_value) => {
            if (disabled) {
              return;
            }

            onValueChange(next_value);
            setOpen(false);
            setSearch("");
          }}
        >
          {filtered_options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="py-2 text-sm"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
          {!filtered_options.length ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
