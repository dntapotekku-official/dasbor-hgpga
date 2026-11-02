import {
  formatCurrency,
  formatCurrencyNumber,
} from "@/lib/nilaiTransaksiBasketSizeTable";

export default function CurrencyValue({ value, className = "", align = "left", fractionDigits = 2 }) {
  if (align === "left" || align === "right") {
    return (
      <span
        className={`block w-full ${align === "right" ? "text-right" : "text-left"} tabular-nums ${className}`}
      >
        {formatCurrency(value, fractionDigits)}
      </span>
    );
  }

  return (
    <span
      className={`grid w-full grid-cols-[auto_1fr] items-baseline gap-2 tabular-nums ${className}`}
    >
      <span className="text-left">Rp</span>
      <span className="text-right">{formatCurrencyNumber(value, fractionDigits)}</span>
    </span>
  );
}
