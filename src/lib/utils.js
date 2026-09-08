import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function dedupeByUuid(items) {
  return Array.from(
    new Map(items.map((item) => [item.uuid, item])).values(),
  );
}

export function dedupeByKey(items, getKey) {
  return Array.from(
    new Map(items.map((item) => [getKey(item), item])).values(),
  );
}
