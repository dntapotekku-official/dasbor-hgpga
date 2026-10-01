export const DEFAULT_DECIMAL_PLACES = 2;

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);

  return Number.isFinite(number) ? number : fallback;
}

export function roundDecimal(value, decimalPlaces = DEFAULT_DECIMAL_PLACES) {
  const factor = 10 ** decimalPlaces;

  return Math.round(toFiniteNumber(value) * factor) / factor;
}

export function comparePercentage(value, divisor) {
  const normalizedDivisor = toFiniteNumber(divisor);

  if (!normalizedDivisor) {
    return 0;
  }

  return (toFiniteNumber(value) / normalizedDivisor) * 100;
}

export function comparePercentageRounded(
  value,
  divisor,
  decimalPlaces = DEFAULT_DECIMAL_PLACES,
) {
  return comparePercentage(
    roundDecimal(value, decimalPlaces),
    roundDecimal(divisor, decimalPlaces),
  );
}

export function formatDecimal(value, maximumFractionDigits = DEFAULT_DECIMAL_PLACES) {
  return toFiniteNumber(value).toLocaleString("id-ID", {
    maximumFractionDigits,
  });
}

export function formatPercentage(value, maximumFractionDigits = DEFAULT_DECIMAL_PLACES) {
  return `${formatDecimal(value, maximumFractionDigits)}%`;
}
