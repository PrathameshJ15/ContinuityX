const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Shared unambiguous date formatter across ContinuityX.
 * Formats dates strictly as "12 Nov 2026" rather than ambiguous "11/12/2026".
 * Handles Date objects, ISO strings, YYYY-MM-DD date-only strings, and unix timestamps.
 */
export function formatDate(
  input: string | number | Date | null | undefined,
  fallback = ""
): string {
  if (!input) return fallback;

  // Handle YYYY-MM-DD date-only strings cleanly without timezone shifting
  if (typeof input === "string") {
    const trimmed = input.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const year = dateOnlyMatch[1];
      const monthIdx = parseInt(dateOnlyMatch[2], 10) - 1;
      const day = parseInt(dateOnlyMatch[3], 10);
      const monthName = MONTHS[monthIdx] || "";
      return `${day} ${monthName} ${year}`;
    }
  }

  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return fallback;

  const day = d.getDate();
  const monthName = MONTHS[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${monthName} ${year}`;
}

/**
 * Shared date-time formatter for audit entries, receipts, and verification timestamps.
 * Formats strictly in 24-hour time with timezone, e.g. "12 Nov 2026, 14:30:00 UTC".
 */
export function formatDateTime(
  input: string | number | Date | null | undefined,
  fallback = ""
): string {
  if (!input) return fallback;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return fallback;

  const dateStr = formatDate(d, fallback);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");

  return `${dateStr}, ${hours}:${minutes}:${seconds} UTC`;
}
