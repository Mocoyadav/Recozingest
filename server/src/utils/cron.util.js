/**
 * Utility for parsing and calculating schedule triggers (Intervals & Standard 5-field Cron)
 */

const INTERVAL_REGEX = /^(\d+)([smhd])$/i;

const parseIntervalMs = (expression) => {
  if (!expression || typeof expression !== 'string') return null;
  const match = expression.trim().match(INTERVAL_REGEX);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
};

const matchesCronField = (val, fieldPattern, min, max) => {
  const pattern = fieldPattern.trim();
  if (pattern === '*') return true;

  if (pattern.startsWith('*/')) {
    const step = parseInt(pattern.slice(2), 10);
    if (isNaN(step) || step <= 0) return false;
    return val % step === 0;
  }

  if (pattern.includes(',')) {
    return pattern.split(',').some((sub) => matchesCronField(val, sub, min, max));
  }

  if (pattern.includes('-')) {
    const [startStr, endStr] = pattern.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end)) return false;
    return val >= start && val <= end;
  }

  const num = parseInt(pattern, 10);
  if (isNaN(num)) return false;
  return val === num;
};

const getNextCronDate = (cronExpression, fromDate = new Date()) => {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)');
  }

  const [minPart, hourPart, domPart, monthPart, dowPart] = parts;

  // Advance by 1 minute and clear seconds/milliseconds
  const candidate = new Date(fromDate.getTime() + 60 * 1000);
  candidate.setSeconds(0, 0);

  // Maximum search limit: 1 year (525,600 minutes)
  const MAX_MINUTES = 525600;
  for (let i = 0; i < MAX_MINUTES; i++) {
    const minute = candidate.getMinutes();
    const hour = candidate.getHours();
    const dom = candidate.getDate();
    const month = candidate.getMonth() + 1; // 1-12
    const dow = candidate.getDay(); // 0-6 (0 = Sunday)

    if (
      matchesCronField(month, monthPart, 1, 12) &&
      matchesCronField(dom, domPart, 1, 31) &&
      matchesCronField(dow, dowPart, 0, 6) &&
      matchesCronField(hour, hourPart, 0, 23) &&
      matchesCronField(minute, minPart, 0, 59)
    ) {
      return candidate;
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error('Unable to find next run date within 1 year for cron expression: ' + cronExpression);
};

const validateScheduleExpression = (type, expression) => {
  if (!expression || typeof expression !== 'string' || !expression.trim()) {
    return { valid: false, error: 'Schedule expression is required' };
  }

  const trimmed = expression.trim();

  if (type === 'INTERVAL') {
    const ms = parseIntervalMs(trimmed);
    if (ms === null) {
      return {
        valid: false,
        error: 'Invalid interval expression. Use format like 10s, 5m, 1h, 1d'
      };
    }
    if (ms < 5000) {
      return { valid: false, error: 'Interval must be at least 5 seconds' };
    }
    return { valid: true };
  }

  if (type === 'CRON') {
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) {
      return {
        valid: false,
        error: 'Cron expression must have 5 parts: minute hour dom month dow (e.g. "*/5 * * * *")'
      };
    }
    try {
      getNextCronDate(trimmed, new Date());
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  return { valid: false, error: `Invalid schedule type: ${type}. Must be INTERVAL or CRON` };
};

const calculateNextRun = (type, expression, fromDate = new Date()) => {
  const validation = validateScheduleExpression(type, expression);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (type === 'INTERVAL') {
    const ms = parseIntervalMs(expression.trim());
    return new Date(fromDate.getTime() + ms);
  }

  if (type === 'CRON') {
    return getNextCronDate(expression.trim(), fromDate);
  }

  throw new Error(`Unsupported schedule type: ${type}`);
};

module.exports = {
  parseIntervalMs,
  matchesCronField,
  getNextCronDate,
  validateScheduleExpression,
  calculateNextRun
};
