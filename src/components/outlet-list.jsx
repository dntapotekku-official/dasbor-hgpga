import { cn } from "@/lib/utils";

/** Menampilkan nama outlet sebagai daftar bullet, termasuk untuk satu outlet. */
export default function OutletList({ names, className }) {
  const outlets = (Array.isArray(names) ? names : [names])
    .map((name) => String(name ?? "").trim())
    .filter((name) => name && name !== "-");

  if (!outlets.length) return "-";

  return (
    <ul className={cn("list-disc space-y-1 pl-4", className)}>
      {outlets.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
    </ul>
  );
}
