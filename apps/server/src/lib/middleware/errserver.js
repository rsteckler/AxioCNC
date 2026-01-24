/**
 * errserver:
 *
 * error-handling middleware, take the same form
 * as regular middleware, however they require an
 * arity of 4, aka the signature (err, req, res, next).
 * when connect has an error, it will invoke ONLY error-handling
 * middleware.
 *
 * If we were to next() here any remaining non-error-handling
 * middleware would then be executed, or if we next(err) to
 * continue passing the error, only error-handling middleware
 * would remain being executed, however here
 * we simply respond with an error page.
 *
 * Examples:
 *
 *     app.use(middleware.errserver({ view: '500', error: 'Internal server error' }))
 *
 * Options:
 *
 *   - view     view
 *   - error    error message
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

const logger = require('../logger');

const getLogger = logger.default || logger;

const log = getLogger('middleware:errserver');

// Lazy load analytics to avoid circular dependencies
let analytics = null;
const getAnalytics = () => {
  if (!analytics) {
    try {
      analytics = require('../../services/analytics');
    } catch (err) {
      // Analytics not available - that's OK
      analytics = { track: () => {}, isEnabled: () => false };
    }
  }
  return analytics;
};

const errserver = (options) => {
  options = options || {};

  let view = options.view || '500',
    error = options.error || '';

  return (err, req, res, next) => {
    if (res.headersSent) {
      log.warn(`Headers already sent for ${req.method} ${req.originalUrl || req.url}`);
      return;
    }

    log.error(err.stack || err.message || err);
    log.error(`Request info: method=${req.method} url=${req.originalUrl || req.url} status=${res.statusCode}`);
    
    // Track error to analytics
    try {
      const analyticsService = getAnalytics();
      if (analyticsService.isEnabled()) {
        const errorMessage = err.message || String(err);
        const sanitizedMessage = errorMessage.length > 200 
          ? errorMessage.substring(0, 200) + '...' 
          : errorMessage;
        
        const stackTrace = err.stack || '';
        const sanitizedStack = stackTrace.length > 500 
          ? stackTrace.substring(0, 500) + '...' 
          : stackTrace;
        
        analyticsService.track('error_occurred', {
          error_type: err.name || 'Error',
          error_message: sanitizedMessage,
          endpoint: req.originalUrl || req.url || 'unknown',
          stack_trace: sanitizedStack,
        });
      }
    } catch (analyticsError) {
      // Don't break error handling if analytics fails
      if (process.env.NODE_ENV === 'development') {
        log.warn('[errserver] Failed to track error:', analyticsError);
      }
    }
    
    // we may use properties of the error object
    // here and next(err) appropriately, or if
    // we possibly recovered from the error, simply next().
    res.status(err.status || 500);
    res.render(view, { error: error });
  };
};

module.exports = errserver;
