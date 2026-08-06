type NumericValue = number | string | bigint | null | undefined;
type DateValue = Date | number | string | null | undefined;

const DEFAULT_EMPTY_VALUE = "—";

function toFiniteNumber(value: NumericValue): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toValidDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export type ShortenAddressOptions = {
  start?: number;
  end?: number;
  emptyValue?: string;
};

export function shortenAddress(
  address: string | null | undefined,
  options: ShortenAddressOptions = {}
): string {
  const { start = 8, end = 6, emptyValue = DEFAULT_EMPTY_VALUE } = options;
  const normalized = address?.trim();

  if (!normalized) {
    return emptyValue;
  }

  if (normalized.length <= start + end + 1) {
    return normalized;
  }

  return `${normalized.slice(0, start)}…${normalized.slice(-end)}`;
}

export type FormatTokenAmountOptions = {
  locale?: string;
  symbol?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  emptyValue?: string;
};

export function formatTokenAmount(
  value: NumericValue,
  options: FormatTokenAmountOptions = {}
): string {
  const amount = toFiniteNumber(value);
  const {
    locale,
    symbol,
    minimumFractionDigits = 0,
    maximumFractionDigits = 7,
    emptyValue = DEFAULT_EMPTY_VALUE,
  } = options;

  if (amount === null) {
    return emptyValue;
  }

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export type FormatFiatAmountOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  emptyValue?: string;
};

export function formatFiatAmount(
  value: NumericValue,
  options: FormatFiatAmountOptions = {}
): string {
  const amount = toFiniteNumber(value);
  const {
    locale,
    currency = "USD",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    emptyValue = DEFAULT_EMPTY_VALUE,
  } = options;

  if (amount === null) {
    return emptyValue;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export type FormatPercentageOptions = {
  locale?: string;
  input?: "decimal" | "percentage";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  emptyValue?: string;
};

export function formatPercentage(
  value: NumericValue,
  options: FormatPercentageOptions = {}
): string {
  const amount = toFiniteNumber(value);
  const {
    locale,
    input = "percentage",
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    emptyValue = DEFAULT_EMPTY_VALUE,
  } = options;

  if (amount === null) {
    return emptyValue;
  }

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(input === "percentage" ? amount / 100 : amount);
}

export type FormatDateTimeOptions = {
  locale?: string;
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
  timeZone?: string;
  emptyValue?: string;
};

export function formatDateTime(
  value: DateValue,
  options: FormatDateTimeOptions = {}
): string {
  const date = toValidDate(value);
  const {
    locale,
    dateStyle = "medium",
    timeStyle = "short",
    timeZone,
    emptyValue = DEFAULT_EMPTY_VALUE,
  } = options;

  if (!date) {
    return emptyValue;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
    timeZone,
  }).format(date);
}
