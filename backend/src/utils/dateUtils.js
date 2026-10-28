/**
 * Date helper utilities
 */

/**
 * Converts a date value to the end of the day (23:59:59.999 UTC)
 * if the input is a string in YYYY-MM-DD format.
 *
 * @param {string|Date} value - Date instance or date string to normalize
 * @returns {Date|null} - Normalized Date object or null if invalid
 */
export const toEndOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

/**
 * Converts a date value to the start of the day (00:00:00.000 UTC)
 * if the input is a string in YYYY-MM-DD format.
 *
 * @param {string|Date} value - Date instance or date string to normalize
 * @returns {Date|null} - Normalized Date object or null if invalid
 */
export const toStartOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
};

export default {
  toEndOfDay,
  toStartOfDay,
};
