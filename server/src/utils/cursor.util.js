/**
 * Utility functions for cursor comparison and checkpoint calculations
 * Supports numbers, ISO date strings, and alphanumeric identifiers.
 */

const isNumeric = (val) => {
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string' && val.trim() !== '') {
    return !isNaN(Number(val));
  }
  return false;
};

const isIsoDate = (val) => {
  if (typeof val !== 'string') return false;
  // Basic ISO date / datetime format check
  if (!/^\d{4}-\d{2}-\d{2}/.test(val)) return false;
  const parsed = Date.parse(val);
  return !isNaN(parsed);
};

/**
 * Compare two cursor values.
 * Returns > 0 if a > b, < 0 if a < b, and 0 if a === b.
 */
const compareCursor = (a, b) => {
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;

  // Numeric comparison
  if (isNumeric(a) && isNumeric(b)) {
    const numA = Number(a);
    const numB = Number(b);
    return numA > numB ? 1 : numA < numB ? -1 : 0;
  }

  // Date comparison
  if (isIsoDate(a) && isIsoDate(b)) {
    const timeA = Date.parse(a);
    const timeB = Date.parse(b);
    return timeA > timeB ? 1 : timeA < timeB ? -1 : 0;
  }

  // Fallback to lexicographical comparison
  const strA = String(a);
  const strB = String(b);
  return strA.localeCompare(strB);
};

/**
 * Check if a candidate value is strictly greater than the cursor.
 */
const isGreaterThanCursor = (value, cursor) => {
  if (cursor === null || cursor === undefined) return true;
  if (value === null || value === undefined) return false;
  return compareCursor(value, cursor) > 0;
};

/**
 * Find the maximum cursor value across an array of records for a given cursor field.
 */
const findMaxCursor = (records, cursorField) => {
  if (!Array.isArray(records) || records.length === 0 || !cursorField) {
    return null;
  }

  let maxVal = null;
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const val = record[cursorField];
    if (val === undefined || val === null) continue;

    if (maxVal === null || compareCursor(val, maxVal) > 0) {
      maxVal = val;
    }
  }

  return maxVal;
};

module.exports = {
  compareCursor,
  isGreaterThanCursor,
  findMaxCursor
};
