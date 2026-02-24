const db = require('../db/database');
const { Errors } = require('./asyncHandler');

/**
 * Creates middleware that validates an entity exists
 * @param {string} table - Database table name
 * @param {string} paramName - Route parameter name (default: 'id')
 * @param {string} entityName - Friendly name for error messages
 * @returns Middleware function
 */
function validateExists(table, paramName = 'id', entityName = null) {
  const displayName = entityName || table.slice(0, -1); // Remove 's' from table name
  
  return (req, res, next) => {
    const id = req.params[paramName];
    const entity = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `${displayName} not found`
        }
      });
    }
    
    // Attach entity to request for use in handler
    req.entity = entity;
    next();
  };
}

/**
 * Validates that a related entity exists (e.g., project for a task)
 * @param {string} table - Database table name
 * @param {string} sourceField - Field in request body to check
 * @param {string} entityName - Friendly name for error messages
 */
function validateRelatedExists(table, sourceField, entityName = null) {
  const displayName = entityName || table.slice(0, -1);
  
  return (req, res, next) => {
    const id = req.body[sourceField];
    
    // Skip if field is not provided or is null
    if (id === undefined || id === null) {
      return next();
    }
    
    const entity = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    
    if (!entity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `${displayName} not found`
        }
      });
    }
    
    next();
  };
}

module.exports = { validateExists, validateRelatedExists };
