const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { PORT, AUTH_SERVICE_URL, BOOKING_SERVICE_URL, FLIGHT_SERVICE_URL } = require('./config/serverConfig');
const { logger } = require('./utils/logger');
const verifyToken = require('./middlewares/auth-middleware');

const app = express();

const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests',
    explanation: 'Read requests are limited. Please retry after a short delay.',
    data: {},
    err: {}
  }
});

const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many write requests',
    explanation: 'Write requests are limited to protect downstream services.',
    data: {},
    err: {}
  }
});

app.use(helmet());
app.use(cors());

// NOTE: express.json() and express.urlencoded() are intentionally NOT applied
// globally. In Express 5, these body parsers consume the request stream entirely,
// leaving req.readable === false. When http-proxy-middleware then tries to pipe
// the original req to the upstream service, it sends Content-Length but 0 bytes
// of body data, causing the upstream to wait forever (timeout). By omitting the
// body parsers here, proxy routes receive an intact readable stream that pipes
// correctly to the target services.

morgan.token('req-id', (req) => req.headers['x-request-id'] || 'unknown');
app.use(morgan((tokens, req, res) => JSON.stringify({
  timestamp: new Date().toISOString(),
  method: tokens.method(req, res),
  url: tokens.url(req, res),
  status: Number(tokens.status(req, res)),
  responseTimeMs: Number(tokens['response-time'](req, res)),
  requestId: tokens['req-id'](req, res),
  remoteAddr: tokens['remote-addr'](req, res),
  userAgent: tokens['user-agent'](req, res)
})));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Gateway is healthy',
    data: {
      service: 'api-gateway',
      status: 'ok'
    },
    err: {}
  });
});

const authProxy = createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/(.*)$': '/api/v1/$1'
  },
  on: {
    error: (err, req, res) => {
      logger.error('AuthService proxy error', { error: err.message, requestId: req.headers['x-request-id'] || 'unknown' });
      res.status(503).json({
        success: false,
        message: 'Auth service unavailable',
        explanation: 'The auth service is temporarily unavailable',
        data: {},
        err: {}
      });
    }
  }
});

const bookingProxy = createProxyMiddleware({
  target: BOOKING_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/(.*)$': '/api/v1/bookings/$1'
  },
  on: {
    error: (err, req, res) => {
      logger.error('BookingService proxy error', { error: err.message, requestId: req.headers['x-request-id'] || 'unknown' });
      res.status(503).json({
        success: false,
        message: 'Booking service unavailable',
        explanation: 'The booking service is temporarily unavailable',
        data: {},
        err: {}
      });
    }
  }
});

const flightProxy = createProxyMiddleware({
  target: FLIGHT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/(.*)$': '/api/v1/$1'
  },
  on: {
    error: (err, req, res) => {
      logger.error('FlightService proxy error', { error: err.message, requestId: req.headers['x-request-id'] || 'unknown' });
      res.status(503).json({
        success: false,
        message: 'Flight service unavailable',
        explanation: 'The flight service is temporarily unavailable',
        data: {},
        err: {}
      });
    }
  }
});

app.use('/api/v1/auth', readRateLimiter, authProxy);
app.use('/api/v1/flights', readRateLimiter, flightProxy);
app.use('/api/v1/bookings', writeRateLimiter, verifyToken, bookingProxy);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    explanation: 'The requested endpoint does not exist on the API Gateway',
    data: {},
    err: {}
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled gateway error', { err: err.message, stack: err.stack, requestId: req.headers['x-request-id'] || 'unknown' });
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    explanation: 'An unexpected error occurred while processing the request',
    data: {},
    err: {}
  });
});

app.listen(PORT, () => {
  logger.info('API Gateway started', { port: PORT });
});

module.exports = app;