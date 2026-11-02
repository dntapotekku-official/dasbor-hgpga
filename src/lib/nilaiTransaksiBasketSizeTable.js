import {
  formatDecimal,
  formatPercentage,
} from "@/lib/number";

export function formatCurrency(value, fractionDigits = 2) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));
}

export function formatCurrencyNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));
}

export { formatDecimal, formatPercentage };

export function formatPeriodRangeLabel(label) {
  const normalizedLabel = String(label ?? "");
  const separatorIndex = normalizedLabel.indexOf(" (");

  return separatorIndex < 0
    ? normalizedLabel
    : normalizedLabel.slice(separatorIndex + 1);
}

export function gapClassName(value) {
  return value > 0
    ? "bg-emerald-100 text-emerald-800"
    : value === 0
      ? "bg-gray-100 text-gray-800"
      : "bg-rose-100 text-rose-800";
}
