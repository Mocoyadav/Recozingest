const crypto = require('crypto');

const ALLOWED_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON'];
const ALLOWED_TRANSFORM_RULES = ['NONE', 'UPPERCASE', 'LOWERCASE', 'TRIM', 'MASK_REDACT', 'MASK_HASH'];

/**
 * Safely access nested properties using dot notation (e.g., 'user.profile.name')
 */
const getNestedValue = (obj, path) => {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  if (obj[path] !== undefined) return obj[path]; // Fast path for direct property

  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[part];
  }
  return curr;
};

/**
 * Apply string or security transform rules
 */
const applyRule = (val, rule) => {
  if (val === null || val === undefined) return val;

  switch (rule) {
    case 'UPPERCASE':
      return String(val).toUpperCase();
    case 'LOWERCASE':
      return String(val).toLowerCase();
    case 'TRIM':
      return typeof val === 'string' ? val.trim() : val;
    case 'MASK_REDACT':
      return '[REDACTED]';
    case 'MASK_HASH':
      return crypto.createHash('sha256').update(String(val)).digest('hex');
    case 'NONE':
    default:
      return val;
  }
};

/**
 * Safely cast value to the specified target type
 */
const castDataType = (val, targetType, defaultValue = null) => {
  if (val === null || val === undefined) {
    return defaultValue !== undefined ? defaultValue : null;
  }

  switch (targetType) {
    case 'STRING':
      return typeof val === 'object' ? JSON.stringify(val) : String(val);

    case 'NUMBER': {
      const num = Number(val);
      return isNaN(num) ? (defaultValue !== undefined ? defaultValue : null) : num;
    }

    case 'BOOLEAN': {
      if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      return Boolean(val);
    }

    case 'DATE': {
      const d = new Date(val);
      return isNaN(d.getTime()) ? (defaultValue !== undefined ? defaultValue : null) : d;
    }

    case 'JSON': {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return defaultValue !== undefined ? defaultValue : val;
        }
      }
      return val;
    }

    default:
      return val;
  }
};

class TransformationService {
  /**
   * Validate transformation configuration structure and rules
   */
  static validateTransformationConfig(config) {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Transformations configuration must be an object' };
    }

    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      return { valid: false, error: 'enabled must be a boolean' };
    }

    if (config.includeUnmapped !== undefined && typeof config.includeUnmapped !== 'boolean') {
      return { valid: false, error: 'includeUnmapped must be a boolean' };
    }

    if (config.addMetadata !== undefined && typeof config.addMetadata !== 'boolean') {
      return { valid: false, error: 'addMetadata must be a boolean' };
    }

    if (config.fieldMappings !== undefined) {
      if (!Array.isArray(config.fieldMappings)) {
        return { valid: false, error: 'fieldMappings must be an array' };
      }

      for (let i = 0; i < config.fieldMappings.length; i++) {
        const mapping = config.fieldMappings[i];
        if (!mapping || typeof mapping !== 'object') {
          return { valid: false, error: `fieldMappings[${i}] must be an object` };
        }

        if (!mapping.sourceField || typeof mapping.sourceField !== 'string' || !mapping.sourceField.trim()) {
          return { valid: false, error: `fieldMappings[${i}].sourceField is required and must be a string` };
        }

        if (!mapping.destinationField || typeof mapping.destinationField !== 'string' || !mapping.destinationField.trim()) {
          return { valid: false, error: `fieldMappings[${i}].destinationField is required and must be a string` };
        }

        if (mapping.dataType && !ALLOWED_DATA_TYPES.includes(mapping.dataType)) {
          return {
            valid: false,
            error: `Invalid dataType '${mapping.dataType}' at fieldMappings[${i}]. Must be one of: ${ALLOWED_DATA_TYPES.join(', ')}`
          };
        }

        if (mapping.transformRule && !ALLOWED_TRANSFORM_RULES.includes(mapping.transformRule)) {
          return {
            valid: false,
            error: `Invalid transformRule '${mapping.transformRule}' at fieldMappings[${i}]. Must be one of: ${ALLOWED_TRANSFORM_RULES.join(', ')}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Transform an individual record
   */
  static transformRecord(record, config = {}, context = {}) {
    if (!record || typeof record !== 'object') {
      return record;
    }

    // Pass-through if transformations are not enabled
    if (!config || config.enabled !== true) {
      return { ...record };
    }

    const includeUnmapped = config.includeUnmapped !== false; // defaults to true
    const fieldMappings = Array.isArray(config.fieldMappings) ? config.fieldMappings : [];

    // Base result: either start with full clone or empty projection
    let result = includeUnmapped ? { ...record } : {};

    // Apply mappings
    for (const mapping of fieldMappings) {
      const srcField = mapping.sourceField.trim();
      const dstField = mapping.destinationField.trim();

      // If including unmapped and renaming field, remove old source property to avoid duplicate
      if (includeUnmapped && srcField !== dstField && Object.prototype.hasOwnProperty.call(result, srcField)) {
        delete result[srcField];
      }

      let val = getNestedValue(record, srcField);

      // Apply default value if source value is missing or null
      if (val === undefined || val === null) {
        if (mapping.defaultValue !== undefined && mapping.defaultValue !== null) {
          val = mapping.defaultValue;
        }
      }

      // Apply value transform rule (e.g. UPPERCASE, MASK_REDACT, MASK_HASH)
      if (mapping.transformRule && mapping.transformRule !== 'NONE') {
        val = applyRule(val, mapping.transformRule);
      }

      // Apply data type casting
      if (mapping.dataType) {
        val = castDataType(val, mapping.dataType, mapping.defaultValue);
      } else if (val === undefined) {
        val = mapping.defaultValue !== undefined ? mapping.defaultValue : null;
      }

      result[dstField] = val;
    }

    // Optional metadata injection
    if (config.addMetadata === true) {
      result._ingestedAt = new Date();
      if (context.pipelineId) {
        result._pipelineId = context.pipelineId.toString();
      }
    }

    return result;
  }

  /**
   * Transform an entire batch of records
   */
  static transformRecords(records, config = {}, context = {}) {
    if (!Array.isArray(records)) {
      return [];
    }

    if (!config || config.enabled !== true) {
      return records.map((r) => (r && typeof r === 'object' ? { ...r } : r));
    }

    return records.map((record) => this.transformRecord(record, config, context));
  }

  /**
   * Preview transformation rules against sample data without database writes
   */
  static previewTransformation(sampleRecords, config = {}, context = {}) {
    const records = Array.isArray(sampleRecords) ? sampleRecords : [sampleRecords];
    const transformed = this.transformRecords(records, config, context);

    return {
      originalCount: records.length,
      transformedCount: transformed.length,
      sampleOriginal: records.slice(0, 3),
      sampleTransformed: transformed.slice(0, 3)
    };
  }
}

module.exports = TransformationService;
