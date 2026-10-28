/**
 * Escapes special regex characters in a string so it can be safely used in RegExp.
 *
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
export const escapeRegex = (str = "") =>
  str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

export default {
  escapeRegex,
};
