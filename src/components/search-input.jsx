"use client";

import { useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SearchInput({ value, onClear, showSearchIcon = false, className, disabled, readOnly, ...props }) {
  const input_ref = useRef(null);

  return (
    <div className="relative w-full min-w-0">
      <Input
        {...props}
        ref={input_ref}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(showSearchIcon && "pl-9", className, "pr-9")}
      />
      {showSearchIcon ? (
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      ) : null}
      {String(value ?? "").length > 0 && !disabled && !readOnly ? (
        <button
          type="button"
          aria-label="Hapus pencarian"
          title="Hapus pencarian"
          className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onClear();
            input_ref.current?.focus();
          }}
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
