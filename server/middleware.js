import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

function init(app) {

  app.use(requireHTTPS);
  app.set('trust proxy', true);
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());
  app.use(helmet.hidePoweredBy());
  app.use(cors());

  const dayInMs = 24 * 60 * 60 * 1000;
  app.use(bodyParser.urlencoded({
    limit: '2mb',
    extended: true,
  }));
  app.use(bodyParser.json({
    limit: '2mb',
  }));

  const cacheControl = isProduction() ? { maxAge: dayInMs, setHeaders: setCustomCacheControl } : null;
  app.use(express.static(fileURLToPath(new URL('dist', import.meta.url)), cacheControl));
}

function setCustomCacheControl(res, path) {
  if (express.static.mime.lookup(path) === 'text/html') {
    res.setHeader('Cache-Control', 'public, max-age=0');
  }
}

function requireHTTPS(req, res, next) {
  const forwardedFromHTTPS = req.headers['x-forwarded-proto'] === 'https';
  if (!forwardedFromHTTPS && isProduction()) {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export default {
  init,
};
