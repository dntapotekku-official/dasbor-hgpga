import {
  formatCurrency,
  formatCurrencyNumber,
} from "@/lib/nilaiTransaksiBasketSizeTable";

export default function CurrencyValue({ value, className = "", align = "split" }) {
  if (align === "right") {
    return (
      <span className={`block w-full text-right tabular-nums ${className}`}>
        {formatCurrency(value)}
      </span>
    );
  }

  return (
    <span
      className={`grid w-full grid-cols-[auto_1fr] items-baseline gap-2 tabular-nums ${className}`}
    >
      <span className="text-left">Rp</span>
      <span className="text-right">{formatCurrencyNumber(value)}</span>
    </span>
  );
}
