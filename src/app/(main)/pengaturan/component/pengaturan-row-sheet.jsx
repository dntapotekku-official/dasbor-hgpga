"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import OptionDropdown from "@/components/option-dropdown";
import CurrencyInput from "@/components/currency-input";
import FieldLabel from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function normalize_placements(value, include_key = false, field_key = "") {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((placement, index) => ({
      uuid: String(placement?.uuid ?? "").trim(),
      outlet_uuid: String(placement?.outlet_uuid ?? "").trim(),
      ...(include_key
        ? {
            key: String(
              placement?.uuid ?? `${field_key}-${index}`,
            ),
          }
        : {}),
    }))
    .filter((placement) => include_key || placement.outlet_uuid);
}

function get_draft_value(item, field) {
  const value = item?.[field.key];

  switch (field.type) {
    case "checkbox":
      return Boolean(value);
    case "multiselect":
      return Array.isArray(value) ? value : [];
    case "placement-list":
      return normalize_placements(value, true, field.key);
    case "tabs":
    case "select":
      return String(value ?? field.options?.[0]?.value ?? "").toLowerCase();
    case "number":
      return String(value ?? "");
    default:
      return Array.isArray(value) ? value.join("\n") : String(value ?? "");
  }
}

function get_saved_value(draft, field) {
  const value = draft[field.key];

  switch (field.type) {
    case "checkbox":
      return Boolean(value);
    case "multiline-list":
      return String(value ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
    case "multiselect":
      return Array.isArray(value) ? value : [];
    case "placement-list":
      return normalize_placements(value);
    case "tabs":
    case "select":
      return String(value ?? "").trim();
    default:
      return String(value ?? "").trim();
  }
}

function build_draft(item, fields) {
  return Object.fromEntries(
    fields.map((field) => [field.key, get_draft_value(item, field)]),
  );
}

function apply_field_change(field, next_draft, next_value) {
  return typeof field.on_change === "function"
    ? {
        ...next_draft,
        ...field.on_change(next_draft, next_value),
      }
    : next_draft;
}

export default function PengaturanRowSheet({
  open,
  on_open_change,
  title,
  description,
  item,
  fields,
  on_save,
  on_delete,
}) {
  const [draft, setDraft] = useState(() => build_draft(item, fields));
  const [open_field_key, setOpenFieldKey] = useState(null);
  const [field_search, setFieldSearch] = useState({});
  const [is_submitting, setIsSubmitting] = useState(false);

  const reset_sheet_state = () => {
    setDraft(build_draft(item, fields));
    setOpenFieldKey(null);
    setFieldSearch({});
  };

  const handle_open_change = (next_open) => {
    if (is_submitting && !next_open) {
      return;
    }

    if (!next_open) {
      reset_sheet_state();
    }

    on_open_change(next_open);
  };

  const handle_save = async () => {
    const missing_required_field = fields.find(
      (field) =>
        field.required &&
        !String(get_saved_value(draft, field) ?? "").trim(),
    );

    if (missing_required_field) {
      toast.error(`${missing_required_field.label} wajib diisi.`);
      return;
    }

    const next_item = {
      ...item,
      ...Object.fromEntries(
        fields.map((field) => [field.key, get_saved_value(draft, field)]),
      ),
    };

    setIsSubmitting(true);

    try {
      await on_save(next_item);
      reset_sheet_state();
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

  const handle_delete = async () => {
    setIsSubmitting(true);

    try {
      await on_delete(item);
      reset_sheet_state();
      on_open_change(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus data.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handle_open_change}>
      <SheetContent className="w-full sm:max-w-lg" showCloseButton={!is_submitting}>
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {fields.map((field) => {
            const is_disabled =
              typeof field.disabled === "function"
                ? Boolean(field.disabled(draft))
                : Boolean(field.disabled);
            const field_helper =
              typeof field.helper === "function"
                ? field.helper(draft)
                : field.helper;

            return (
              <div key={field.key} className="space-y-2">
              {field.type !== "checkbox" ? (
                <FieldLabel htmlFor={field.key} label={field.label} required={Boolean(field.required)} />
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
                      setDraft((current) => {
                        const checked = event.target.checked;
                        const next_draft = {
                          ...current,
                          [field.key]: checked,
                        };

                        return apply_field_change(field, next_draft, checked);
                      })
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
                      {(field.options ?? [])
                        .filter((option) => draft[field.key].includes(option.value))
                        .map((option) => (
                          <li key={`${field.key}-${option.value}`}>{option.label}</li>
                        ))}
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
                    className="flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="truncate text-foreground">
                      {Array.isArray(draft[field.key]) && draft[field.key].length > 0
                        ? `${draft[field.key].length} ${field.selection_label ?? "item"} dipilih`
                        : field.placeholder}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                  {open_field_key === field.key && !is_disabled ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg">
                      <div className="relative p-1">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={field_search[field.key] ?? ""}
                          onChange={(event) =>
                            setFieldSearch((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                          placeholder={field.search_placeholder ?? "Cari item..."}
                          className="h-9 pl-8"
                        />
                      </div>
                      {field.options
                        ?.filter((option) =>
                          option.label
                            .toLowerCase()
                            .includes((field_search[field.key] ?? "").trim().toLowerCase()),
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
                            .includes((field_search[field.key] ?? "").trim().toLowerCase()),
                        )
                        .length ? (
                        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                          {field.empty_search_message ?? "Data tidak ditemukan."}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : field.type === "placement-list" ? (
                <div className="space-y-3">
                  {Array.isArray(draft[field.key]) && draft[field.key].length > 0 ? (
                    draft[field.key].map((placement, index) => {
                      const current_value = String(placement?.outlet_uuid ?? "").trim();
                      const selected_outlet_values = new Set(
                        (draft[field.key] ?? [])
                          .map((item) => String(item?.outlet_uuid ?? "").trim())
                          .filter(Boolean),
                      );

                      return (
                        <div
                          key={placement.key ?? `${field.key}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <OptionDropdown
                              id={`${field.key}-${index}`}
                              value={current_value}
                              options={[
                                {
                                  value: "",
                                  label: "Pilih outlet",
                                },
                                ...(
                                  field.options?.filter((option) => {
                                    const is_selected_elsewhere =
                                      selected_outlet_values.has(option.value) &&
                                      option.value !== current_value;

                                    return !is_selected_elsewhere;
                                  }) ?? []
                                ),
                              ]}
                              onValueChange={(next_value) =>
                                setDraft((current) => {
                                  const next_placements = (current[field.key] ?? []).map(
                                    (item, item_index) =>
                                      item_index === index
                                        ? {
                                            ...item,
                                            outlet_uuid: next_value,
                                          }
                                        : item,
                                  );
                                  const next_draft = {
                                    ...current,
                                    [field.key]: next_placements,
                                  };

                                  return apply_field_change(field, next_draft, next_placements);
                                })
                              }
                              ariaLabel={`Pilih outlet penempatan ${index + 1}`}
                              searchable
                              searchPlaceholder="Cari outlet..."
                              emptyMessage="Outlet tidak ditemukan."
                            />
                          </div>
                          <Button
                            type="button"
                            variant="delete"
                            size="icon-sm"
                            className="shrink-0"
                            onClick={() =>
                              setDraft((current) => {
                                const next_placements = (current[field.key] ?? []).filter(
                                  (_, item_index) => item_index !== index,
                                );
                                const next_draft = {
                                  ...current,
                                  [field.key]: next_placements,
                                };

                                return apply_field_change(field, next_draft, next_placements);
                              })
                            }
                          >
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Hapus penempatan</span>
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                      Belum ada penempatan outlet.
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDraft((current) => {
                        const next_placements = [
                          ...(current[field.key] ?? []),
                          {
                            uuid: "",
                            outlet_uuid: "",
                            key: `${field.key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          },
                        ];
                        const next_draft = {
                          ...current,
                          [field.key]: next_placements,
                        };

                        return apply_field_change(field, next_draft, next_placements);
                      })
                    }
                    className="w-full"
                  >
                    <PlusIcon className="size-4" />
                    Tambah Penempatan
                  </Button>
                </div>
              ) : field.type === "tabs" ? (
                <Tabs
                  value={String(draft[field.key] ?? "")}
                  onValueChange={(next_value) =>
                    setDraft((current) => {
                      const next_draft = {
                        ...current,
                        [field.key]: next_value,
                      };

                      return apply_field_change(field, next_draft, next_value);
                    })
                  }
                  className="w-full"
                >
                  <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
                    {(field.options ?? []).map((option) => (
                      <TabsTrigger
                        key={option.value}
                        value={option.value}
                        disabled={is_disabled}
                        className="min-w-max flex-1 px-4 py-2"
                      >
                        {option.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : field.type === "select" ? (
                <OptionDropdown
                  id={field.key}
                  value={String(draft[field.key] ?? "")}
                  options={field.options ?? []}
                  disabled={is_disabled}
                  onValueChange={(next_value) =>
                    setDraft((current) => {
                      const next_draft = {
                        ...current,
                        [field.key]: next_value,
                      };

                      return apply_field_change(field, next_draft, next_value);
                    })
                  }
                  ariaLabel={field.aria_label ?? field.label}
                  searchable={field.searchable}
                  searchPlaceholder={field.search_placeholder}
                  emptyMessage={field.empty_search_message}
                />
              ) : field.type === "currency" ? (
                <CurrencyInput
                  id={field.key}
                  value={draft[field.key] ?? ""}
                  disabled={is_disabled}
                  required={field.required}
                  aria-required={field.required || undefined}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                  placeholder={field.placeholder}
                />
              ) : (
                <Input
                  id={field.key}
                  type={field.input_type ?? field.type ?? "text"}
                  value={draft[field.key] ?? ""}
                  disabled={is_disabled}
                  required={field.required}
                  aria-required={field.required || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  min={field.min}
                  step={field.step}
                />
              )}
              {field_helper ? (
                <p className="text-xs text-muted-foreground">{field_helper}</p>
              ) : null}
              </div>
            );
          })}
        </div>
        <div className="grid gap-2 border-t p-4">
          {on_delete && item ? (
            <Button
              type="button"
              variant="delete"
              onClick={handle_delete}
              className="w-full"
            >
              Hapus Data
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handle_save}
            className="w-full"
          >
            Simpan Perubahan
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
