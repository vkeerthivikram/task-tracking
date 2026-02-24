/**
 * Wraps async route handlers with automatic error handling
 * Eliminates repetitive try/catch blocks in route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(error => {
      console.error('Route error:', error);
      
      // Handle custom error objects with status/code
      const status = error.status || 500;
      const code = error.code || 'INTERNAL_ERROR';
      const message = error.message || 'An error occurred';
      
      res.status(status).json({
        success: false,
        error: { code, message }
      });
    });
  };
}

/**
 * Creates a custom error with status and code
 */
function createError(message, code = 'INTERNAL_ERROR', status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

// Common error creators
const Errors = {
  notFound: (entity = 'Entity') => createError(`${entity} not found`, 'NOT_FOUND', 404),
  validation: (message) => createError(message, 'VALIDATION_ERROR', 400),
  fetch: (entity = 'data') => createError(`Failed to fetch ${entity}`, 'FETCH_ERROR', 500),
  create: (entity = 'entity') => createError(`Failed to create ${entity}`, 'CREATE_ERROR', 500),
  update: (entity = 'entity') => createError(`Failed to update ${entity}`, 'UPDATE_ERROR', 500),
  delete: (entity = 'entity') => createError(`Failed to delete ${entity}`, 'DELETE_ERROR', 500),
};

module.exports = { asyncHandler, createError, Errors };
