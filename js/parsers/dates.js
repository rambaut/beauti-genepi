/**
 * dates.js — parse sampling dates into decimal years.
 */

const CUMULATIVE_DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function dayOfYear(year, month, day) {
  return CUMULATIVE_DAYS_BEFORE_MONTH[month - 1] + day + (month > 2 && isLeapYear(year) ? 1 : 0);
}

/**
 * Parse a date string into { decimal, precision } or null if unparseable.
 * Accepts YYYY-MM-DD, YYYY-MM, YYYY and decimal years (e.g. 2020.25).
 * Partial dates are placed at the midpoint of their month or year.
 */
export function parseDate(dateString) {
  const text = String(dateString ?? '').trim();
  let match;

  if ((match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { decimal: year + (dayOfYear(year, month, day) - 0.5) / daysInYear(year), precision: 'day' };
  }
  if ((match = text.match(/^(\d{4})-(\d{1,2})$/))) {
    const [year, month] = [Number(match[1]), Number(match[2])];
    if (month < 1 || month > 12) return null;
    const monthStart = dayOfYear(year, month, 1) - 1;
    const monthEnd = month === 12 ? daysInYear(year) : dayOfYear(year, month + 1, 1) - 1;
    return { decimal: year + (monthStart + monthEnd) / 2 / daysInYear(year), precision: 'month' };
  }
  if ((match = text.match(/^(\d{4})$/))) {
    return { decimal: Number(match[1]) + 0.5, precision: 'year' };
  }
  if ((match = text.match(/^(\d{4}\.\d+)$/))) {
    return { decimal: Number(match[1]), precision: 'decimal' };
  }
  return null;
}

/** Format a decimal year for display and XML. */
export function formatDecimalYear(decimal) {
  return decimal === null || decimal === undefined ? '' : decimal.toFixed(4);
}

/**
 * Extract a field from a taxon name split by a delimiter.
 * Negative field indices count from the end (-1 = last field).
 */
export function fieldFromName(name, delimiter, fieldIndex) {
  const fields = name.split(delimiter);
  const index = fieldIndex < 0 ? fields.length + fieldIndex : fieldIndex;
  return fields[index] ?? '';
}
