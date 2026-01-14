/* eslint callback-return: 0 */
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import compress from 'compression';
import cookieParser from 'cookie-parser';
import multiparty from 'connect-multiparty';
import connectRestreamer from 'connect-restreamer';
import engines from 'consolidate';
import errorhandler from 'errorhandler';
import express from 'express';
import expressJwt from 'express-jwt';
import session from 'express-session';
import httpProxy from 'http-proxy';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import 'hogan.js'; // required by consolidate
import i18next from 'i18next';
import i18nextBackend from 'i18next-node-fs-backend';
import jwt from 'jsonwebtoken';
import methodOverride from 'method-override';
import morgan from 'morgan';
import favicon from 'serve-favicon';
import serveStatic from 'serve-static';
import sessionFileStore from 'session-file-store';
import _get from 'lodash/get';
import _noop from 'lodash/noop';
import castArray from 'lodash/castArray';
import find from 'lodash/find';
import rimraf from 'rimraf';
import {
  LanguageDetector as i18nextLanguageDetector,
  handle as i18nextHandle
} from 'i18next-express-middleware';
import urljoin from './lib/urljoin';
import logger from './lib/logger';
import settings from './config/settings';
import * as api from './api';
import errclient from './lib/middleware/errclient';
import errlog from './lib/middleware/errlog';
import errnotfound from './lib/middleware/errnotfound';
import errserver from './lib/middleware/errserver';
import config from './services/configstore';
import mediamtxService from './services/mediamtx';
import {
  authorizeIPAddress,
  validateUser
} from './access-control';
import {
  ERR_FORBIDDEN
} from './constants';

const log = logger('app');

const renderPage = (view = 'index', cb = _noop) => (req, res, next) => {
  // Override IE's Compatibility View Settings
  // http://stackoverflow.com/questions/6156639/x-ua-compatible-is-set-to-ie-edge-but-it-still-doesnt-stop-compatibility-mode
  res.set({ 'X-UA-Compatible': 'IE=edge' });

  const locals = { ...cb(req, res) };
  res.render(view, locals);
};

const appMain = () => {
  const app = express();

  { // Settings
    if (process.env.NODE_ENV === 'development') {
      // Error handler - https://github.com/expressjs/errorhandler
      // Development error handler, providing stack traces and error message responses
      // for requests accepting text, html, or json.
      app.use(errorhandler());

      // a custom "verbose errors" setting which can be used in the templates via settings['verbose errors']
      app.enable('verbose errors'); // Enables verbose errors in development
      app.disable('view cache'); // Disables view template compilation caching in development
    } else {
      // a custom "verbose errors" setting which can be used in the templates via settings['verbose errors']
      app.disable('verbose errors'); // Disables verbose errors in production
      app.enable('view cache'); // Enables view template compilation caching in production
    }

    app.enable('trust proxy'); // Enables reverse proxy support, disabled by default
    app.enable('case sensitive routing'); // Enable case sensitivity, disabled by default, treating "/Foo" and "/foo" as the same
    app.disable('strict routing'); // Enable strict routing, by default "/foo" and "/foo/" are treated the same by the router
    app.disable('x-powered-by'); // Enables the X-Powered-By: Express HTTP header, enabled by default

    for (let i = 0; i < settings.view.engines.length; ++i) {
      const extension = settings.view.engines[i].extension;
      const template = settings.view.engines[i].template;
      app.engine(extension, engines[template]);
    }
    app.set('view engine', settings.view.defaultExtension); // The default engine extension to use when omitted
    app.set('views', [
      path.resolve(__dirname, '../app'),
      path.resolve(__dirname, 'views'),
      path.resolve(__dirname, '../..') // Project root for index.hbs
    ]); // The view directory path

    log.debug('app.settings: %j', app.settings);
  }

  // Setup i18n (i18next)
  i18next
    .use(i18nextBackend)
    .use(i18nextLanguageDetector)
    .init(settings.i18next);

  app.use(async (req, res, next) => {
    try {
      // IP Address Access Control
      const ipaddr = req.ip || req.connection.remoteAddress;
      await authorizeIPAddress(ipaddr);
    } catch (err) {
      log.warn(err);
      res.status(ERR_FORBIDDEN).end('Forbidden Access');
      return;
    }

    next();
  });

  // Removes the 'X-Powered-By' header in earlier versions of Express
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
  });

  // Middleware
  // https://github.com/senchalabs/connect

  try {
    // https://github.com/valery-barysok/session-file-store
    const path = settings.middleware.session.path; // Defaults to './axiocnc-sessions'

    // Ensure session directory exists (don't delete it first - preserve existing sessions)
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }

    const FileStore = sessionFileStore(session);
    app.use(session({
      // https://github.com/expressjs/session#secret
      secret: settings.secret,

      // https://github.com/expressjs/session#resave
      resave: true,

      // https://github.com/expressjs/session#saveuninitialized
      saveUninitialized: true,

      store: new FileStore({
        path: path,
        logFn: (...args) => {
          log.debug.apply(log, args);
        }
      })
    }));
  } catch (err) {
    log.error(err);
  }

  app.use(favicon(path.join(_get(settings, 'assets.app.path', ''), 'favicon.ico')));
  app.use(cookieParser());

  // Connect's body parsing middleware. This only handles urlencoded and json bodies.
  // https://github.com/expressjs/body-parser
  app.use(bodyParser.json(settings.middleware['body-parser'].json));
  app.use(bodyParser.urlencoded(settings.middleware['body-parser'].urlencoded));

  // For multipart bodies, please use the following modules:
  // - [busboy](https://github.com/mscdex/busboy) and [connect-busboy](https://github.com/mscdex/connect-busboy)
  // - [multiparty](https://github.com/andrewrk/node-multiparty) and [connect-multiparty](https://github.com/andrewrk/connect-multiparty)
  app.use(multiparty(settings.middleware.multiparty));

  // https://github.com/dominictarr/connect-restreamer
  // connect's bodyParser has a problem when using it with a proxy.
  // It gobbles up all the body events, so that the proxy doesn't see anything!
  app.use(connectRestreamer());

  // https://github.com/expressjs/method-override
  app.use(methodOverride());
  if (settings.verbosity > 0) {
    // https://github.com/expressjs/morgan#use-custom-token-formats
    // Add an ID to all requests and displays it using the :id token
    morgan.token('id', (req, res) => {
      return req.session.id;
    });
    app.use(morgan(settings.middleware.morgan.format));
  }
  app.use(compress(settings.middleware.compression));

  Object.keys(settings.assets).forEach((name) => {
    const asset = settings.assets[name];

    log.debug('assets: name=%s, asset=%s', name, JSON.stringify(asset));
    if (!(asset.path)) {
      log.error('asset path is not defined');
      return;
    }

    asset.routes.forEach((assetRoute) => {
      const route = urljoin(settings.route || '/', assetRoute || '');
      log.debug('> route=%s', name, route);
      app.use(route, serveStatic(asset.path, {
        maxAge: asset.maxAge
      }));
    });
  });

  app.use(i18nextHandle(i18next, {}));

  { // Secure API Access
    app.use(urljoin(settings.route, 'api'), expressJwt({
      secret: config.get('secret'),
      credentialsRequired: true
    }));

    app.use(async (err, req, res, next) => {
      let bypass = !(err && (err.name === 'UnauthorizedError'));

      // Check whether the app is running in development mode
      bypass = bypass || (process.env.NODE_ENV === 'development');

      // Check whether the request path is not restricted
      const whitelist = [
        // Also see "src/app/api/index.js"
        urljoin(settings.route, 'api/signin')
      ];
      bypass = bypass || whitelist.some(path => {
        return req.path.indexOf(path) === 0;
      });

      if (!bypass) {
        // Check whether the provided credential is correct
        const token = _get(req, 'query.token') || _get(req, 'body.token');
        try {
          // User Validation
          const user = jwt.verify(token, settings.secret) || {};
          await validateUser(user);
          bypass = true;
        } catch (err) {
          log.warn(err);
        }
      }

      if (!bypass) {
        const ipaddr = req.ip || req.connection.remoteAddress;
        log.warn(`Forbidden: ipaddr=${ipaddr}, code="${err.code}", message="${err.message}"`);
        res.status(ERR_FORBIDDEN).end('Forbidden Access');
        return;
      }

      next();
    });
  }

  { // Register API routes with public access
    // Also see "src/app/app.js"
    app.post(urljoin(settings.route, 'api/signin'), api.users.signin);
  }

  { // Register API routes with authorized access
    // Version
    app.get(urljoin(settings.route, 'api/version/current'), api.version.getCurrentVersion);
    app.get(urljoin(settings.route, 'api/version/latest'), api.version.getLatestVersion);

    // System Settings (Zod-validated)
    app.get(urljoin(settings.route, 'api/settings'), api.settings.get);
    app.post(urljoin(settings.route, 'api/settings'), api.settings.set);
    app.delete(urljoin(settings.route, 'api/settings'), api.settings.reset);

    // Extensions (schemaless, for widgets/plugins)
    app.get(urljoin(settings.route, 'api/extensions'), api.extensions.get);
    app.post(urljoin(settings.route, 'api/extensions'), api.extensions.set);
    app.delete(urljoin(settings.route, 'api/extensions'), api.extensions.unset);

    // Tool Config
    app.get(urljoin(settings.route, 'api/tool'), api.tool.get);
    app.post(urljoin(settings.route, 'api/tool'), api.tool.set);

    // G-code
    app.get(urljoin(settings.route, 'api/gcode'), api.gcode.fetch);
    app.post(urljoin(settings.route, 'api/gcode'), api.gcode.upload);
    app.get(urljoin(settings.route, 'api/gcode/download'), api.gcode.download);
    app.post(urljoin(settings.route, 'api/gcode/download'), api.gcode.download); // Alias

    // Workfiles (file storage)
    app.get(urljoin(settings.route, 'api/workfiles'), api.workfiles.list);
    app.post(urljoin(settings.route, 'api/workfiles'), api.workfiles.upload);
    app.get(urljoin(settings.route, 'api/workfiles/:filename'), api.workfiles.read);

    // Controllers
    app.get(urljoin(settings.route, 'api/controllers'), api.controllers.get);

    // Machine Status
    app.get(urljoin(settings.route, 'api/machine/status'), api.machine.getStatus);

    // Commands
    app.get(urljoin(settings.route, 'api/commands'), api.commands.fetch);
    app.post(urljoin(settings.route, 'api/commands'), api.commands.create);
    app.get(urljoin(settings.route, 'api/commands/:id'), api.commands.read);
    app.put(urljoin(settings.route, 'api/commands/:id'), api.commands.update);
    app.delete(urljoin(settings.route, 'api/commands/:id'), api.commands.__delete);
    app.post(urljoin(settings.route, 'api/commands/run/:id'), api.commands.run);

    // Events
    app.get(urljoin(settings.route, 'api/events'), api.events.fetch);
    app.post(urljoin(settings.route, 'api/events/'), api.events.create);
    app.get(urljoin(settings.route, 'api/events/:id'), api.events.read);
    app.put(urljoin(settings.route, 'api/events/:id'), api.events.update);
    app.delete(urljoin(settings.route, 'api/events/:id'), api.events.__delete);

    // Machines
    app.get(urljoin(settings.route, 'api/machines'), api.machines.fetch);
    
    // Machine Presets
    app.get(urljoin(settings.route, 'api/machine-presets'), api.machinePresets.fetch);
    app.post(urljoin(settings.route, 'api/machines'), api.machines.create);
    app.get(urljoin(settings.route, 'api/machines/:id'), api.machines.read);
    app.put(urljoin(settings.route, 'api/machines/:id'), api.machines.update);
    app.delete(urljoin(settings.route, 'api/machines/:id'), api.machines.__delete);

    // Macros
    app.get(urljoin(settings.route, 'api/macros'), api.macros.fetch);
    app.post(urljoin(settings.route, 'api/macros'), api.macros.create);
    app.get(urljoin(settings.route, 'api/macros/:id'), api.macros.read);
    app.put(urljoin(settings.route, 'api/macros/:id'), api.macros.update);
    app.delete(urljoin(settings.route, 'api/macros/:id'), api.macros.__delete);

    // Tools (Tool Library)
    app.get(urljoin(settings.route, 'api/tools'), api.tools.fetch);
    app.post(urljoin(settings.route, 'api/tools'), api.tools.create);
    app.get(urljoin(settings.route, 'api/tools/:id'), api.tools.read);
    app.put(urljoin(settings.route, 'api/tools/:id'), api.tools.update);
    app.delete(urljoin(settings.route, 'api/tools/:id'), api.tools.__delete);

    // Gamepads (server-side joystick support - Linux only)
    app.get(urljoin(settings.route, 'api/gamepads'), api.gamepads.list);
    app.get(urljoin(settings.route, 'api/gamepads/platform'), api.gamepads.getPlatform);
    app.get(urljoin(settings.route, 'api/gamepads/diagnostic'), api.gamepads.getDiagnostic);
    app.post(urljoin(settings.route, 'api/gamepads/refresh'), api.gamepads.refresh);
    app.get(urljoin(settings.route, 'api/gamepads/selected'), api.gamepads.getSelected);
    app.post(urljoin(settings.route, 'api/gamepads/selected'), api.gamepads.setSelected);
    app.get(urljoin(settings.route, 'api/gamepads/state'), api.gamepads.getState);

    // Streams (camera streaming)
    app.get(urljoin(settings.route, 'api/streams/:id'), api.streams.get);

    // Cameras (camera management)
    app.get(urljoin(settings.route, 'api/cameras'), api.cameras.fetch);
    app.post(urljoin(settings.route, 'api/cameras'), api.cameras.create);
    app.get(urljoin(settings.route, 'api/cameras/:id'), api.cameras.read);
    app.put(urljoin(settings.route, 'api/cameras/:id'), api.cameras.update);
    app.delete(urljoin(settings.route, 'api/cameras/:id'), api.cameras.__delete);

    // MDI
    app.get(urljoin(settings.route, 'api/mdi'), api.mdi.fetch);
    app.post(urljoin(settings.route, 'api/mdi'), api.mdi.create);
    app.put(urljoin(settings.route, 'api/mdi'), api.mdi.bulkUpdate);
    app.get(urljoin(settings.route, 'api/mdi/:id'), api.mdi.read);
    app.put(urljoin(settings.route, 'api/mdi/:id'), api.mdi.update);
    app.delete(urljoin(settings.route, 'api/mdi/:id'), api.mdi.__delete);

    // Users
    app.get(urljoin(settings.route, 'api/users'), api.users.fetch);
    app.post(urljoin(settings.route, 'api/users/'), api.users.create);
    app.get(urljoin(settings.route, 'api/users/:id'), api.users.read);
    app.put(urljoin(settings.route, 'api/users/:id'), api.users.update);
    app.delete(urljoin(settings.route, 'api/users/:id'), api.users.__delete);

    // Watch (legacy single-folder API)
    app.get(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.post(urljoin(settings.route, 'api/watch/files'), api.watch.getFiles);
    app.get(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);
    app.post(urljoin(settings.route, 'api/watch/file'), api.watch.readFile);

    // Watch Folders (new multi-folder API)
    app.get(urljoin(settings.route, 'api/watchfolders'), api.watchfolders.fetch);
    app.post(urljoin(settings.route, 'api/watchfolders'), api.watchfolders.create);
    app.get(urljoin(settings.route, 'api/watchfolders/browse'), api.watchfolders.browse);
    app.get(urljoin(settings.route, 'api/watchfolders/:id'), api.watchfolders.read);
    app.put(urljoin(settings.route, 'api/watchfolders/:id'), api.watchfolders.update);
    app.delete(urljoin(settings.route, 'api/watchfolders/:id'), api.watchfolders.__delete);

    // Themes
    app.get(urljoin(settings.route, 'api/themes'), api.themes.fetch);
    app.post(urljoin(settings.route, 'api/themes'), api.themes.create);
    app.get(urljoin(settings.route, 'api/themes/path'), api.themes.getPath);
    app.get(urljoin(settings.route, 'api/themes/:id'), api.themes.read);
    app.put(urljoin(settings.route, 'api/themes/:id'), api.themes.update);
    app.delete(urljoin(settings.route, 'api/themes/:id'), api.themes.__delete);
  }

  { // MJPEG proxy for HTTP cameras with Basic Auth
    // Route must come before the general /streams/:id/* route
    app.get(urljoin(settings.route, 'streams/:id/mjpeg'), (req, res) => {
      const streamId = req.params.id;
      
      // Get camera by ID from cameras array
      const cameras = castArray(config.get('cameras', []));
      const camera = find(cameras, { id: streamId });
      
      // Check if camera exists, is enabled, and is MJPEG type
      if (!camera || !camera.enabled || camera.type !== 'mjpeg') {
        log.debug(`MJPEG stream not found: camera=${!!camera}, enabled=${camera?.enabled}, type=${camera?.type}`);
        res.status(404).send({
          msg: 'Stream not found',
        });
        return;
      }
      
      try {
        // Build URL - use credentials from camera object if available, otherwise from URL
        let upstreamUrlString = camera.inputUrl;
        
        // Check if URL has masked password (****) - if so, we need to use separate credentials
        const hasMaskedPassword = upstreamUrlString.includes(':****@');
        
        // If we have separate username/password, use those instead of URL credentials
        if (camera.username || camera.password) {
          try {
            // Remove any existing credentials from URL
            const urlObj = new URL(upstreamUrlString);
            urlObj.username = '';
            urlObj.password = '';
            upstreamUrlString = urlObj.toString();
          } catch (err) {
            log.warn(`Failed to parse URL: ${err.message}`);
          }
        } else if (hasMaskedPassword) {
          log.error(`Camera ${streamId} has masked password in URL but no separate credentials provided`);
          res.status(500).send({
            msg: 'Camera configuration error: password is masked but no credentials available',
          });
          return;
        }
        
        const upstreamUrl = new URL(upstreamUrlString);
        
        // Build upstream request options
        const isHttps = upstreamUrl.protocol === 'https:';
        const defaultPort = isHttps ? 443 : 80;
        
        const requestOptions = {
          hostname: upstreamUrl.hostname,
          port: upstreamUrl.port ? parseInt(upstreamUrl.port, 10) : defaultPort,
          path: upstreamUrl.pathname + upstreamUrl.search,
          method: 'GET',
          headers: {
            'Accept-Encoding': 'identity', // No compression
            'User-Agent': 'AxioCNC-MJPEG-Proxy/1.0',
          },
        };
        
        // Add Basic Auth if credentials are provided
        // ALWAYS prefer separate username/password fields over URL-embedded credentials
        // URL credentials might be masked (****) or incorrect
        if (camera.username || camera.password) {
          const authString = `${camera.username || ''}:${camera.password || ''}`;
          const auth = Buffer.from(authString).toString('base64');
          requestOptions.headers['Authorization'] = `Basic ${auth}`;
        } else if (upstreamUrl.username && upstreamUrl.password && !upstreamUrl.password.includes('****')) {
          // Fallback: credentials in URL (only if password is not masked)
          const authString = `${upstreamUrl.username}:${upstreamUrl.password}`;
          const auth = Buffer.from(authString).toString('base64');
          requestOptions.headers['Authorization'] = `Basic ${auth}`;
        } else {
          log.warn(`No valid authentication provided for ${streamId} - camera may require auth`);
        }
        
        // Use http or https based on protocol
        const httpModule = isHttps ? https : http;
        
        // Helper function to generate Digest Auth response
        const generateDigestAuth = (username, password, method, path, wwwAuthenticate) => {
          // Parse WWW-Authenticate header
          const authParams = {};
          const authHeader = wwwAuthenticate.replace(/Digest\s+/, '');
          authHeader.split(',').forEach(param => {
            const match = param.trim().match(/(\w+)="?([^",]+)"?/);
            if (match) {
              authParams[match[1]] = match[2];
            }
          });
          
          const realm = authParams.realm || '';
          const nonce = authParams.nonce || '';
          const qop = authParams.qop || '';
          const opaque = authParams.opaque || '';
          
          // Generate cnonce (client nonce)
          const cnonce = crypto.randomBytes(16).toString('hex');
          
          // Calculate HA1 = MD5(username:realm:password)
          const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
          
          // Calculate HA2 = MD5(method:uri)
          const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
          
          // Calculate response = MD5(HA1:nonce:nonceCount:cnonce:qop:HA2)
          // For simplicity, we use nonceCount=00000001
          const nonceCount = '00000001';
          const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nonceCount}:${cnonce}:${qop}:${ha2}`).digest('hex');
          
          // Build Authorization header
          let authHeaderValue = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}"`;
          if (qop) {
            authHeaderValue += `, qop=${qop}, nc=${nonceCount}, cnonce="${cnonce}"`;
          }
          if (opaque) {
            authHeaderValue += `, opaque="${opaque}"`;
          }
          
          return authHeaderValue;
        };
        
        // Make upstream request
        const upstreamReq = httpModule.request(requestOptions, (upstreamRes) => {
          // Check for authentication errors - if 401 and we have credentials, try Digest Auth
          if (upstreamRes.statusCode === 401 && (camera.username || camera.password)) {
            const wwwAuthenticate = upstreamRes.headers['www-authenticate'];
            
            if (wwwAuthenticate && wwwAuthenticate.toLowerCase().startsWith('digest')) {
              // Close the first request
              upstreamRes.destroy();
              upstreamReq.destroy();
              
              // Generate Digest Auth header
              const digestAuth = generateDigestAuth(
                camera.username || '',
                camera.password || '',
                'GET',
                requestOptions.path,
                wwwAuthenticate
              );
              
              // Create new request with Digest Auth (replace Basic Auth)
              const digestRequestOptions = {
                ...requestOptions,
                headers: {
                  ...requestOptions.headers,
                  'Authorization': digestAuth,
                }
              };
              
              // Make second request with Digest Auth
              const digestReq = httpModule.request(digestRequestOptions, (digestRes) => {
                
                if (digestRes.statusCode === 401) {
                  log.error(`MJPEG stream ${streamId} authentication failed (401) with Digest Auth. Check camera credentials.`);
                  if (!res.headersSent) {
                    res.status(401).send({
                      msg: 'Camera authentication failed. Please check username and password in camera settings.',
                    });
                  }
                  digestRes.destroy();
                  return;
                }
                
                // Success - stream the response
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Content-Type', digestRes.headers['content-type'] || 'multipart/x-mixed-replace');
                
                digestRes.pipe(res);
                
                digestRes.on('error', (err) => {
                  log.error(`MJPEG upstream response error (Digest Auth) for ${streamId}: ${err.message}`);
                  if (!res.headersSent) {
                    res.status(502).send({
                      msg: 'Stream error',
                      error: err.message
                    });
                  } else {
                    res.destroy();
                  }
                });
              });
              
              digestReq.on('error', (err) => {
                log.error(`MJPEG upstream request error (Digest Auth) for ${streamId}: ${err.message}`);
                if (!res.headersSent) {
                  res.status(502).send({
                    msg: 'Failed to connect to camera',
                    error: err.message
                  });
                } else {
                  res.destroy();
                }
              });
              
              // Handle client disconnect
              req.on('close', () => {
                if (!digestReq.destroyed) {
                  digestReq.destroy();
                }
              });
              
              res.on('close', () => {
                if (!digestReq.destroyed) {
                  digestReq.destroy();
                }
              });
              
              digestReq.end();
              return;
            } else {
              // Not Digest Auth, return error
              log.error(`MJPEG stream ${streamId} authentication failed (401). Check camera credentials.`);
              if (!res.headersSent) {
                res.status(401).send({
                  msg: 'Camera authentication failed. Please check username and password in camera settings.',
                });
              }
              upstreamRes.destroy();
              return;
            }
          }
          
          if (upstreamRes.statusCode !== 200) {
            log.error(`MJPEG stream ${streamId} returned status ${upstreamRes.statusCode}`);
            if (!res.headersSent) {
              res.status(502).send({
                msg: `Camera returned error: ${upstreamRes.statusCode}`,
              });
            }
            upstreamRes.destroy();
            return;
          }
          
          // Set response headers
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'multipart/x-mixed-replace');
          
          // Stream the response directly
          upstreamRes.pipe(res);
          
          // Handle upstream response errors
          upstreamRes.on('error', (err) => {
            log.error(`MJPEG upstream response error for ${streamId}: ${err.message}`);
            if (!res.headersSent) {
              res.status(502).send({
                msg: 'Stream error',
                error: err.message
              });
            } else {
              res.destroy();
            }
          });
        });
        
        // Handle upstream request errors
        upstreamReq.on('error', (err) => {
          log.error(`MJPEG upstream request error for ${streamId}: ${err.message}`);
          if (!res.headersSent) {
            res.status(502).send({
              msg: 'Failed to connect to camera',
              error: err.message
            });
          } else {
            res.destroy();
          }
        });
        
        // Handle client disconnect - abort upstream request
        req.on('close', () => {
          log.debug(`Client disconnected from MJPEG stream ${streamId}, aborting upstream request`);
          if (!upstreamReq.destroyed) {
            upstreamReq.destroy();
          }
        });
        
        res.on('close', () => {
          log.debug(`Response closed for MJPEG stream ${streamId}, aborting upstream request`);
          if (!upstreamReq.destroyed) {
            upstreamReq.destroy();
          }
        });
        
        // Send the request
        upstreamReq.end();
        
      } catch (err) {
        log.error(`Error setting up MJPEG proxy for ${streamId}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send({
            msg: 'Failed to setup stream proxy',
            error: err.message
          });
        }
      }
    });
  }

  { // Reverse proxy for MediaMTX streams (HLS)
    // Proxy /streams/:id/* to MediaMTX HTTP server (127.0.0.1:8888)
    const mediamtxPort = mediamtxService.getHttpPort();
    const proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${mediamtxPort}`,
      changeOrigin: false,
    });

    proxy.on('proxyReq', (proxyReq, req, res) => {
      // Rewrite path: /streams/camera1/index.m3u8 -> /camera1/index.m3u8
      const streamId = req.params.id;
      const originalPath = proxyReq.path || '';
      const mediaMTXPath = originalPath.replace(`/streams/${streamId}`, `/${streamId}`);
      
      proxyReq.path = mediaMTXPath;
      // HLS streaming continuously requests segments - don't log every request
    });

    proxy.on('error', (err, req, res) => {
      log.error(`MediaMTX proxy error: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).send({
          msg: 'Stream proxy error',
          error: err.message
        });
      }
    });

    // Proxy all /streams/:id/* requests to MediaMTX (except /mjpeg which is handled above)
    app.all(urljoin(settings.route, 'streams/:id/*'), (req, res) => {
      const streamId = req.params.id;
      
      // Get camera to verify it's RTSP
      const cameras = castArray(config.get('cameras', []));
      const camera = find(cameras, { id: streamId });
      
      // Return 404 if camera doesn't exist, isn't enabled, or isn't RTSP
      if (!camera || !camera.enabled || camera.type !== 'rtsp') {
        res.status(404).send({
          msg: 'Stream not found',
        });
        return;
      }
      
      // Skip if this is an MJPEG request (already handled above)
      if (req.path.endsWith('/mjpeg')) {
        res.status(404).send({
          msg: 'Stream not found',
        });
        return;
      }
      
      // Proxy to MediaMTX for HLS streams
      proxy.web(req, res);
    });
  }

  // page - serve Vite-built index.html directly
  app.get(urljoin(settings.route, '/'), (req, res) => {
    const appPath = _get(settings, 'assets.app.path', '');
    const indexPath = path.join(appPath, 'index.html');
    
    // Check if Vite-built index.html exists, otherwise fall back to template
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Fallback to template if index.html doesn't exist
      return renderPage('index.hbs', (req, res) => {
        const webroot = _get(settings, 'assets.app.routes[0]', ''); // with trailing slash
        const lng = req.language;
        const t = req.t;

        return {
          webroot: webroot,
          lang: lng,
          title: `${t('title')} ${settings.version}`,
          loading: t('loading')
        };
      })(req, res);
    }
  });

  // SPA catch-all route: serve index.hbs for all client-side routes
  // This allows React Router to handle routing on the client side
  app.get('*', (req, res, next) => {
    // Skip API routes - let them fall through to 404 if not found
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // Skip static file requests (js, css, images, etc.) - let them fall through to 404 if not found
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/i)) {
      return next();
    }

    // Skip Socket.IO requests
    if (req.path.startsWith('/socket.io/')) {
      return next();
    }

    // Serve Vite-built index.html for all other routes (client-side routes)
    const appPath = _get(settings, 'assets.app.path', '');
    const indexPath = path.join(appPath, 'index.html');
    
    // Check if Vite-built index.html exists, otherwise fall back to template
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Fallback to template if index.html doesn't exist
      return renderPage('index.hbs', (req, res) => {
        const webroot = _get(settings, 'assets.app.routes[0]', ''); // with trailing slash
        const lng = req.language;
        const t = req.t;

        return {
          webroot: webroot,
          lang: lng,
          title: `${t('title')} ${settings.version}`,
          loading: t('loading')
        };
      })(req, res, next);
    }
  });

  { // Error handling
    app.use(errlog());
    app.use(errclient({
      error: 'XHR error'
    }));
    app.use(errnotfound({
      view: path.join('common', '404.hogan'),
      error: 'Not found'
    }));
    app.use(errserver({
      view: path.join('common', '500.hogan'),
      error: 'Internal server error'
    }));
  }

  return app;
};

export default appMain;
