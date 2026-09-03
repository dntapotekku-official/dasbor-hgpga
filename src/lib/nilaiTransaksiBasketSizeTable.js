export function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatCurrencyNumber(value) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDecimal(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits,
  });
}

export function formatPercentage(value, maximumFractionDigits = 2) {
  return `${formatDecimal(value, maximumFractionDigits)}%`;
}

export function gapClassName(value) {
  return value > 0
    ? "bg-emerald-100 text-emerald-800"
    : value === 0
      ? "bg-gray-100 text-gray-800"
      : "bg-rose-100 text-rose-800";
}
