// @ts-nocheck
import { bStroopToXlm } from "./soroban";

export function mask_middle(input, n = 5, mask = "***") {
  if (input == null) return "";
  if (n < 0) throw new Error("n must be >= 0");

  const len = input?.length;
  if (len === 0) return "";

  const take = Math.min(n, Math.floor(len / 2));
  if (take === 0) return input; // e.g., single-character strings

  return input.slice(0, take) + mask + input.slice(-take);
}

export function formatToLocalDateTime(
  isoString,
  locale = undefined // uses user's local browser locale
) {
  if (!isoString || typeof isoString !== "string") {
    throw new Error("Invalid date string");
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid ISO date");
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTimestamp(timestamp) {
  const date = new Date(Number(timestamp));

  const localDate = date.toLocaleString("en-US", {
    year: "numeric", // Year (e.g., "2025")
    month: "long", // Full month name (e.g., "April")
    day: "numeric", // Day of the month (e.g., "10")
    hour: "2-digit", // Hour (e.g., "11")
    minute: "2-digit", // Minute (e.g., "24")
    hour12: true, // 12-hour format (AM/PM)
  });

  return localDate;
}

export function formatPrice(price) {
  const direct = price?.price?.direct;
  const viaXLM = price?.price?.viaXLM;

  const receivedPrice = Number(direct || viaXLM || 0);
  let dp;

  if (receivedPrice === 0) {
    dp = 2;
  } else {
    dp = receivedPrice > 0.1 ? 2 : receivedPrice > 0.01 ? 4 : 6;
  }

  return receivedPrice.toFixed(dp);
}

export function formatPortfolio(tokens, prices) {
  let total = 0;
  const portfolio = {};
  const values = {};

  const balances = {};

  // First pass: calculate total
  for (const token of tokens) {
    const receivedPrice = Number(token?.price?.selectedPrice || 0);

    total += receivedPrice * (token?.balance || 0);
  }

  // Second pass: calculate portfolio share
  for (const token of tokens) {
    const receivedPrice = Number(token?.price?.selectedPrice || 0);

    const amount = token?.balance;

    const value = (receivedPrice || 0) * (amount || 0);

    values[token?.contract] = value.toFixed(3);

    const percentage = total ? (value * 100) / total : 0;

    const numericAmount = Number(amount) || 0;

    const dp = numericAmount > 0.1 ? 2 : numericAmount > 0.01 ? 4 : 6;

    portfolio[token?.contract] = percentage.toFixed(2);
    balances[token?.contract] = Number(amount || 0).toFixed(dp);
  }

  return {
    portfolio,
    values,
    total: total > 0 ? total.toFixed(3) : null,
  };
}

export function formatValue(value) {
  if (value === null || value === undefined || isNaN(value)) return "0.00";

  const num = Number(value);

  // Case: >= 1 → normal 2dp
  if (num >= 1) {
    return num.toFixed(2);
  }

  // Convert to string with high precision
  const str = num.toFixed(20);

  // Find first non-zero after decimal
  const match = str.match(/^0\.0*([1-9])/);

  if (!match) return "0.00";

  const firstSigIndex = str.indexOf(match[1]);

  // Keep up to 2 digits after first significant digit
  const endIndex = firstSigIndex + 2;

  return str.slice(0, endIndex);
}
