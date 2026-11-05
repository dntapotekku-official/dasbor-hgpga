"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import OptionDropdown from "@/components/option-dropdown";
import { Button } from "@/components/ui/button";

/** Mengelola beberapa pilihan jabatan beserta statusnya pada satu penempatan. */
export default function PlacementPositionsEditor({ value, options, placementNumber, onChange }) {
  const selected = new Set(value.map((jabatan) => jabatan.uuid_jabatan_master).filter(Boolean));

  return (
    <div className="space-y-2">
      {value.map((jabatan, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <OptionDropdown
              value={jabatan.uuid_jabatan_master}
              options={[
                { value: "", label: "Pilih jabatan" },
                ...options.filter((option) => !selected.has(option.value) || option.value === jabatan.uuid_jabatan_master),
              ]}
              onValueChange={(uuid_jabatan_master) => onChange(value.map((item, item_index) => item_index === index
                ? { ...item, uuid_jabatan_master, jabatan_name: options.find((option) => option.value === uuid_jabatan_master)?.label ?? "" }
                : item))}
              ariaLabel={`Jabatan ${index + 1} penempatan ${placementNumber}`}
              searchable
              searchPlaceholder="Cari jabatan..."
              emptyMessage="Jabatan tidak ditemukan."
            />
          </div>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={jabatan.is_active} onChange={(event) => onChange(value.map((item, item_index) => item_index === index ? { ...item, is_active: event.target.checked } : item))} />
            Aktif
          </label>
          <Button type="button" variant="delete" size="icon-sm" aria-label={`Hapus jabatan ${index + 1} penempatan ${placementNumber}`} onClick={() => onChange(value.filter((_, item_index) => item_index !== index))}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { uuid_jabatan_master: "", jabatan_name: "", is_active: true }])}>
        <PlusIcon className="size-4" /> Tambah jabatan
      </Button>
    </div>
  );
}
