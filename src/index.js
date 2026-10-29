const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const CircuitBreaker = require('opossum');

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

// Correlation ID Propagation
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-id'] = reqId; // Forward to downstream
  res.setHeader('x-request-id', reqId);
  next();
});

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

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Airline Reservation System — API Gateway is Online',
    version: '1.0.0',
    architecture: 'Event-Driven Distributed Microservices',
    endpoints: {
      aggregateHealth: 'http://localhost:3004/api/v1/health/aggregate',
      gatewayHealth: 'http://localhost:3004/api/v1/health',
      flightCatalog: 'http://localhost:3004/api/v1/flights/flight',
      rabbitMQDashboard: 'http://localhost:15672 (guest / guest)',
      auth: {
        signup: 'POST /api/v1/auth/signup',
        signin: 'POST /api/v1/auth/signin',
        verifyOtp: 'POST /api/v1/auth/verify-otp'
      },
      bookings: {
        createBooking: 'POST /api/v1/bookings (Auth Bearer Token)',
        listBookings: 'GET /api/v1/bookings (Auth Bearer Token)',
        getBookingById: 'GET /api/v1/bookings/:id (Auth Bearer Token)',
        cancelBooking: 'PATCH /api/v1/bookings/:id/cancel (Auth Bearer Token)'
      }
    }
  });
});

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

app.get('/api/v1/health/aggregate', async (req, res) => {
  const services = [
    { name: 'auth', url: `${AUTH_SERVICE_URL}/api/v1/health` },
    { name: 'bookings', url: `${BOOKING_SERVICE_URL}/api/v1/health` },
    { name: 'flights', url: `${FLIGHT_SERVICE_URL}/api/v1/health` }
  ];
  
  const results = await Promise.allSettled(
    services.map(s => axios.get(s.url, { 
        headers: { 'x-request-id': req.headers['x-request-id'] },
        timeout: 2000 
    }))
  );
  
  const responseData = {};
  results.forEach((r, i) => {
    responseData[services[i].name] = r.status === 'fulfilled' ? 'up' : 'down';
  });
  
  res.status(200).json({
    success: true,
    message: 'Aggregated health status',
    data: responseData,
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

// --- Circuit Breaker + Retry for FlightsAndSearch ---

const asyncRetry = async (fn, retries, delay) => {
  try {
      return await fn();
  } catch (error) {
      // Checking for transient errors (Network issues or 5xx)
      const isTransient = !error.response || error.response.status >= 500 || ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED'].includes(error.code);
      if (retries > 0 && isTransient) {
          await new Promise(r => setTimeout(r, delay));
          return asyncRetry(fn, retries - 1, delay * 2);
      }
      throw error;
  }
};

const flightBreaker = new CircuitBreaker(async (reqOpts) => {
  return asyncRetry(() => axios(reqOpts), 2, 200); // 2 retries, 200ms initial delay (200ms -> 400ms)
}, {
  errorThresholdPercentage: 50,
  resetTimeout: 10000, // Cooldown 10s
  timeout: 10000, // Total timeout for a single circuit breaker run (including retries)
  volumeThreshold: 5 // Open after 5 failures in the window
});

const customFlightProxy = async (req, res, next) => {
  try {
      let bodyBuffer = Buffer.alloc(0);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) {
              chunks.push(chunk);
          }
          bodyBuffer = Buffer.concat(chunks);
      }
      
      // Rewrite path similar to original `^/(.*)$': '/api/v1/$1'`
      const targetPath = req.url === '/' ? '' : req.url;
      const reqOpts = {
          method: req.method,
          url: `${FLIGHT_SERVICE_URL}/api/v1${targetPath}`,
          headers: { ...req.headers },
          data: bodyBuffer.length > 0 ? bodyBuffer : undefined,
          timeout: 5000, 
          validateStatus: status => status < 500 // Treat 5xx as errors for circuit breaker tracking and retry
      };
      delete reqOpts.headers['host']; // Prevents host mismatch

      const response = await flightBreaker.fire(reqOpts);
      
      res.status(response.status);
      for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
      }
      res.send(response.data);
  } catch (error) {
      logger.error('FlightService circuit breaker/proxy error', { error: error.message, requestId: req.headers['x-request-id'] || 'unknown' });
      res.status(503).json({
          success: false,
          message: 'Flight service unavailable',
          explanation: 'The flight service is temporarily unavailable or circuit is open',
          data: {},
          err: {}
      });
  }
};

// --- End custom Flights Proxy ---

app.use('/api/v1/auth', readRateLimiter, authProxy);
app.use('/api/v1/flights', readRateLimiter, customFlightProxy);
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