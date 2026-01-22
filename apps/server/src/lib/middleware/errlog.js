/**
 * errlog:
 *
 *   Write request and error information to stderr, loggly, or similar services.
 *
 * Examples:
 *
 *   app.use(middleware.errlog())
 *
 * @return {Function}
 * @api public
 */

const logger = require('../logger');

const getLogger = logger.default || logger;

const log = getLogger('middleware:errlog');

const errlog = () => {
  return (err, req, res, next) => {
    log.error(err.stack || err.message || err);
    log.error(`Request info: method=${req.method} url=${req.originalUrl || req.url} headersSent=${res.headersSent} status=${res.statusCode}`);
    next(err);
  };
};

module.exports = errlog;
