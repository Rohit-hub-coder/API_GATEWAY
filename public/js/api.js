// api.js - Centralized API Client with Latency Measurement and Distributed Tracing Hooks
const API = (() => {
  const BASE_URL = window.location.origin;

  async function request(path, options = {}) {
    const startTime = performance.now();
    const headers = { ...options.headers };

    // Attach JWT Bearer Token if available
    const token = State.get().session.token;
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach or generate Correlation ID
    const reqId = headers['x-request-id'] || 'req_' + Math.random().toString(36).substring(2, 10);
    headers['x-request-id'] = reqId;

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    options.headers = headers;
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

    let status = 0;
    let resData = null;
    let errorMsg = null;

    try {
      const response = await fetch(url, options);
      status = response.status;
      const text = await response.text();

      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = text;
      }

      if (!response.ok) {
        errorMsg = (resData && (resData.explanation || resData.message)) || `HTTP ${status}`;
      }
    } catch (err) {
      status = 0;
      errorMsg = err.message || 'Network / connection failure';
    }

    const durationMs = Math.round(performance.now() - startTime);

    // Record to Distributed Trace Pipeline
    const traceEntry = {
      id: reqId,
      timestamp: new Date().toISOString(),
      method: options.method || 'GET',
      path,
      url,
      status,
      durationMs,
      reqHeaders: headers,
      reqBody: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null,
      resBody: resData,
      success: status >= 200 && status < 300,
      errorMsg
    };

    State.addTrace(traceEntry);

    return {
      status,
      ok: status >= 200 && status < 300,
      data: resData ? resData.data : null,
      raw: resData,
      durationMs,
      errorMsg
    };
  }

  return {
    // 1. Health Checks
    async checkGatewayHealth() {
      const res = await request('/api/v1/health');
      return {
        status: res.ok ? 'up' : 'down',
        latencyMs: res.durationMs
      };
    },

    async checkAggregateHealth() {
      const res = await request('/api/v1/health/aggregate');
      if (res.ok && res.raw && res.raw.data) {
        const d = res.raw.data;
        const l = res.raw.latencyMs || {};
        return {
          auth: { status: d.auth || 'down', latencyMs: l.auth ?? null },
          bookings: { status: d.bookings || 'down', latencyMs: l.bookings ?? null },
          flights: { status: d.flights || 'down', latencyMs: l.flights ?? null },
          reminder: { status: d.reminder || 'down', latencyMs: l.reminder ?? null }
        };
      }
      return {
        auth: { status: 'down', latencyMs: null },
        bookings: { status: 'down', latencyMs: null },
        flights: { status: 'down', latencyMs: null },
        reminder: { status: 'down', latencyMs: null }
      };
    },

    async checkRabbitMQStatus() {
      const res = await request('/api/v1/rabbitmq/status');
      if (res.ok && res.raw && res.raw.data) {
        return {
          status: 'up',
          latencyMs: res.raw.latencyMs ?? res.durationMs,
          stats: res.raw.data
        };
      }
      return {
        status: 'down',
        latencyMs: res.durationMs,
        stats: res.raw?.data || {
          name: 'REMINDER_QUEUE',
          messages_ready: 'n/a',
          consumers: 'n/a',
          published: 'n/a',
          delivered: 'n/a',
          acknowledged: 'n/a'
        }
      };
    },

    // 2. Auth Endpoints
    async signup(name, email, password) {
      return request('/api/v1/auth/signup', {
        method: 'POST',
        body: { name, email, password }
      });
    },

    async verifyOtp(email, otp) {
      return request('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: { email, otp }
      });
    },

    async signin(email, password) {
      return request('/api/v1/auth/signin', {
        method: 'POST',
        body: { email, password }
      });
    },

    async getProfile() {
      return request('/api/v1/auth/profile');
    },

    // 3. Flight Endpoints
    async getFlights() {
      return request('/api/v1/flights/flight');
    },

    async getFlight(id) {
      return request(`/api/v1/flights/flight/${id}`);
    },

    async getCities() {
      return request('/api/v1/flights/city');
    },

    // 4. Booking Endpoints
    async getBookings() {
      return request('/api/v1/bookings');
    },

    async getBooking(id) {
      return request(`/api/v1/bookings/${id}`);
    },

    async createBooking(flightId, noOfSeats) {
      return request('/api/v1/bookings', {
        method: 'POST',
        body: { flightId, noOfSeats }
      });
    },

    async cancelBooking(id) {
      return request(`/api/v1/bookings/${id}/cancel`, {
        method: 'PATCH'
      });
    }
  };
})();

window.API = API;
