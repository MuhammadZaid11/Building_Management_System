const { ApiError } = require('./apiError');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBlank(value) {
  return value === undefined || value === '';
}

function label(field) {
  return field.split('.').pop();
}

function reject(errors, field, message) {
  errors.push({ field, message });
}

function parseString(value, rule, errors, field) {
  if (typeof value !== 'string') {
    reject(errors, field, `${label(field)} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    if (rule.nullable) {
      return null;
    }

    reject(errors, field, `${label(field)} is required`);
    return undefined;
  }

  if (rule.minLength && trimmed.length < rule.minLength) {
    reject(errors, field, `${label(field)} must be at least ${rule.minLength} characters`);
    return undefined;
  }

  if (rule.maxLength && trimmed.length > rule.maxLength) {
    reject(errors, field, `${label(field)} must be at most ${rule.maxLength} characters`);
    return undefined;
  }

  return trimmed;
}

function parseUuid(value, errors, field) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!UUID_PATTERN.test(text)) {
    reject(errors, field, `${label(field)} must be a valid id`);
    return undefined;
  }

  return text;
}

function parseInteger(value, rule, errors, field) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!/^-?\d+$/.test(text)) {
    reject(errors, field, `${label(field)} must be an integer`);
    return undefined;
  }

  const parsed = Number(text);

  if (!Number.isSafeInteger(parsed)) {
    reject(errors, field, `${label(field)} is out of range`);
    return undefined;
  }

  if (rule.min !== undefined && parsed < rule.min) {
    reject(errors, field, `${label(field)} must be at least ${rule.min}`);
    return undefined;
  }

  if (rule.max !== undefined && parsed > rule.max) {
    reject(errors, field, `${label(field)} must be at most ${rule.max}`);
    return undefined;
  }

  return parsed;
}

function parseDecimal(value, errors, field) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!/^-?\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
    reject(errors, field, `${label(field)} must be a number`);
    return undefined;
  }

  return text;
}

function parseDateTime(value, errors, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    reject(errors, field, `${label(field)} must be an ISO timestamp`);
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    reject(errors, field, `${label(field)} must be an ISO timestamp`);
    return undefined;
  }

  return parsed;
}

function parseEnum(value, rule, errors, field) {
  const text = typeof value === 'string' ? value.trim() : value;

  if (!rule.values.includes(text)) {
    reject(errors, field, `${label(field)} must be one of: ${rule.values.join(', ')}`);
    return undefined;
  }

  return text;
}

function parseEmail(value, errors, field) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) || text.length > 254) {
    reject(errors, field, `${label(field)} must be a valid email address`);
    return undefined;
  }

  return text;
}

function parseBoolean(value, errors, field) {
  if (typeof value !== 'boolean') {
    reject(errors, field, `${label(field)} must be true or false`);
    return undefined;
  }

  return value;
}

function parseReadingId(value, errors, field) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';

  if (!/^[1-9]\d*$/.test(text)) {
    reject(errors, field, `${label(field)} must be a valid id`);
    return undefined;
  }

  return BigInt(text);
}

function parseField(value, rule, errors, field) {
  switch (rule.type) {
    case 'string':
      return parseString(value, rule, errors, field);
    case 'uuid':
      return parseUuid(value, errors, field);
    case 'int':
      return parseInteger(value, rule, errors, field);
    case 'decimal':
      return parseDecimal(value, errors, field);
    case 'datetime':
      return parseDateTime(value, errors, field);
    case 'enum':
      return parseEnum(value, rule, errors, field);
    case 'readingId':
      return parseReadingId(value, errors, field);
    case 'email':
      return parseEmail(value, errors, field);
    case 'boolean':
      return parseBoolean(value, errors, field);
    default:
      reject(errors, field, `${label(field)} cannot be validated`);
      return undefined;
  }
}

function validate(schema) {
  return function validateRequest(req, res, next) {
    const errors = [];
    const validated = { body: {}, query: {}, params: {} };

    for (const source of ['params', 'query', 'body']) {
      const fields = schema[source] || {};
      const input = req[source] && typeof req[source] === 'object' ? req[source] : {};

      for (const [key, rule] of Object.entries(fields)) {
        const raw = input[key];
        const field = `${source}.${key}`;

        if (raw === null) {
          if (rule.nullable) {
            validated[source][key] = null;
          } else if (rule.required) {
            reject(errors, field, `${key} is required`);
          } else {
            reject(errors, field, `${key} cannot be null`);
          }
          continue;
        }

        if (isBlank(raw)) {
          if (rule.required) {
            reject(errors, field, `${key} is required`);
          } else if (rule.default !== undefined) {
            validated[source][key] = rule.default;
          }
          continue;
        }

        const parsed = parseField(raw, rule, errors, field);

        if (parsed !== undefined) {
          validated[source][key] = parsed;
        }
      }
    }

    if (schema.requireAny && !schema.requireAny.some((key) => validated.body[key] !== undefined)) {
      reject(errors, 'body', 'At least one field is required');
    }

    if (typeof schema.refine === 'function') {
      schema.refine(validated, errors);
    }

    if (errors.length > 0) {
      next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', errors));
      return;
    }

    req.validated = validated;
    next();
  };
}

module.exports = { validate };
