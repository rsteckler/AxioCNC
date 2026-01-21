/**
 * errclient
 *
 * Examples:
 *
 *     app.use(middleware.errclient({ error: 'XHR error' }))
 *
 * Options:
 *
 *   - error    error message
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

const logger = require('../logger');

const log = logger('middleware:errclient');

const errclient = (options) => {
  options = options || {};

  let error = options.error || '';

  return (err, req, res, next) => {
    if (res.headersSent) {
      log.warn(`Headers already sent for ${req.method} ${req.originalUrl || req.url}`);
      return;
    }

    if (req.xhr) {
      res.send(500, {
        error: error
      });
      return;
    }

    next(err);
  };
};

module.exports = errclient;
