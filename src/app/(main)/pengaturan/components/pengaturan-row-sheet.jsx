"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function build_draft(item, fields) {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.type === "checkbox"
        ? Boolean(item?.[field.key])
        : field.type === "multiselect"
        ? Array.isArray(item?.[field.key])
          ? item[field.key]
          : []
        : field.type === "select"
          ? String(item?.[field.key] ?? field.options?.[0]?.value ?? "").toLowerCase()
        : Array.isArray(item?.[field.key])
          ? item[field.key].join("\n")
        : String(item?.[field.key] ?? ""),
    ]),
  );
}

function get_selected_option_labels(options = [], selected_values = []) {
  const selected_value_set = new Set(selected_values);

  return options
    .filter((option) => selected_value_set.has(option.value))
    .map((option) => option.label);
}

function get_field_disabled(field, draft) {
  return typeof field.disabled === "function"
    ? Boolean(field.disabled(draft))
    : Boolean(field.disabled);
}

function get_field_helper(field, draft) {
  return typeof field.helper === "function"
    ? field.helper(draft)
    : field.helper;
}

export default function PengaturanRowSheet({
  open,
  on_open_change,
  title,
  description,
  item,
  fields,
  on_save,
}) {
  const [draft, setDraft] = useState(() => build_draft(item, fields));
  const [openFieldKey, setOpenFieldKey] = useState(null);
  const [fieldSearch, setFieldSearch] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handle_save = async () => {
    setIsSubmitting(true);

    const next_item = {
      ...item,
      ...Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.type === "checkbox"
            ? Boolean(draft[field.key])
            : field.type === "multiline-list"
            ? draft[field.key]
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean)
            : field.type === "multiselect"
              ? draft[field.key]
              : field.type === "select"
                ? String(draft[field.key] ?? "").trim()
              : draft[field.key].trim(),
        ]),
      ),
    };

    try {
      await on_save(next_item);
      on_open_change(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan perubahan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={on_open_change}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {fields.map((field) => {
            const is_disabled = get_field_disabled(field, draft);
            const field_helper = get_field_helper(field, draft);

            return (
            <div key={field.key} className="space-y-2">
              {field.type !== "checkbox" ? (
                <Label htmlFor={field.key}>{field.label}</Label>
              ) : null}
              {field.type === "checkbox" ? (
                <label
                  htmlFor={field.key}
                  className={`flex items-center gap-3 rounded-lg text-sm ${
                    is_disabled ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <input
                    id={field.key}
                    type="checkbox"
                    checked={Boolean(draft[field.key])}
                    disabled={is_disabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field.key]: event.target.checked,
                      }))
                    }
                    className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/50"
                  />
                  <span className="text-foreground">
                    {field.placeholder || field.label}
                  </span>
                </label>
              ) : field.type === "multiline-list" ? (
                <textarea
                  id={field.key}
                  value={draft[field.key] ?? ""}
                  disabled={is_disabled}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="flex min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              ) : field.type === "multiselect" ? (
                <div className="relative">
                  {Array.isArray(draft[field.key]) && draft[field.key].length > 0 ? (
                    <ul className="mb-2 list-disc space-y-1 pl-4 text-sm text-foreground">
                      {get_selected_option_labels(field.options, draft[field.key]).map(
                        (option_label) => (
                          <li key={`${field.key}-${option_label}`}>{option_label}</li>
                        ),
                      )}
                    </ul>
                  ) : null}
                  <button
                    type="button"
                    id={field.key}
                    disabled={is_disabled}
                    onClick={() =>
                      setOpenFieldKey((current) => {
                        const next_key = current === field.key ? null : field.key;

                        if (next_key === null) {
                          setFieldSearch((current_search) => ({
                            ...current_search,
                            [field.key]: "",
                          }));
                        }

                        return next_key;
                      })
                    }
                    className={`flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      is_disabled ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    <span className="truncate text-foreground">
                      {Array.isArray(draft[field.key]) && draft[field.key].length > 0
                        ? `${draft[field.key].length} outlet dipilih`
                        : field.placeholder}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  {openFieldKey === field.key ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg">
                      <div className="relative p-1">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={fieldSearch[field.key] ?? ""}
                          onChange={(event) =>
                            setFieldSearch((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          placeholder="Cari outlet..."
                          className="h-9 pl-8"
                        />
                      </div>
                      {field.options
                        ?.filter((option) =>
                          option.label
                            .toLowerCase()
                            .includes((fieldSearch[field.key] ?? "").trim().toLowerCase()),
                        )
                        .map((option) => {
                        const selected = draft[field.key]?.includes(option.value);

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                [field.key]: selected
                                  ? current[field.key].filter((value) => value !== option.value)
                                  : [...(current[field.key] ?? []), option.value],
                              }))
                            }
                            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                          >
                            <span>{option.label}</span>
                            {selected ? <CheckIcon className="size-4 text-primary" /> : null}
                          </button>
                        );
                      })}
                      {!field.options
                        ?.filter((option) =>
                          option.label
                            .toLowerCase()
                            .includes((fieldSearch[field.key] ?? "").trim().toLowerCase()),
                        )
                        .length ? (
                        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                          Outlet tidak ditemukan.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : field.type === "select" ? (
                <div className="relative">
                  <button
                    type="button"
                    id={field.key}
                    disabled={is_disabled}
                    onClick={() =>
                      setOpenFieldKey((current) =>
                        current === field.key ? null : field.key,
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                      is_disabled ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    <span className="truncate text-foreground">
                      {field.options?.find((option) => option.value === draft[field.key])?.label ??
                        field.placeholder}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  {openFieldKey === field.key ? (
                    <div className="absolute z-20 mt-2 w-full rounded-lg border bg-popover p-2 shadow-lg">
                      {field.options?.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              [field.key]: option.value,
                            }));
                            setOpenFieldKey(null);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span>{option.label}</span>
                          {draft[field.key] === option.value ? (
                            <CheckIcon className="size-4 text-primary" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Input
                  id={field.key}
                  value={draft[field.key] ?? ""}
                  disabled={is_disabled}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                />
              )}
              {field_helper ? (
                <p className="text-xs text-muted-foreground">{field_helper}</p>
              ) : null}
            </div>
          );
          })}
        </div>
        <div className="border-t p-4">
          <Button
            type="button"
            onClick={handle_save}
            disabled={isSubmitting}
            className="w-full"
          >
            Simpan Perubahan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
