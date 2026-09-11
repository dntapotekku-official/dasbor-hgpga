"use client";

import { Input } from "@/components/ui/input";

function format_currency_input(value, allow_decimals) {
  const [integer_part = "", decimal_part] = String(value ?? "").split(".");
  const digits = integer_part.replace(/\D/g, "");

  if (!digits && decimal_part === undefined) {
    return "";
  }

  const formatted_integer = (digits || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return allow_decimals && decimal_part !== undefined
    ? `${formatted_integer},${decimal_part.slice(0, 2)}`
    : formatted_integer;
}

function parse_currency_input(value, allow_decimals) {
  const normalized_value = String(value ?? "").replace(/[^\d,.]/g, "");
  const [integer_part = "", ...decimal_parts] = normalized_value.split(",");
  const integer_digits = integer_part.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  if (!integer_digits && !decimal_parts.length) {
    return "";
  }

  if (!allow_decimals || !decimal_parts.length) {
    return integer_digits || "0";
  }

  const decimal_digits = decimal_parts.join("").replace(/\D/g, "").slice(0, 2);

  return `${integer_digits || "0"}.${decimal_digits}`;
}

export default function CurrencyInput({
  allowDecimals = false,
  onValueChange,
  value,
  ...props
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      value={format_currency_input(value, allowDecimals)}
      onChange={(event) =>
        onValueChange(parse_currency_input(event.target.value, allowDecimals))
      }
    />
  );
}
