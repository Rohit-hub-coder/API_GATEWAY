// state.js - Central Reactive State Store for Airline Management System Showcase
const State = (() => {
  const subscribers = {};

  const state = {
    session: {
      token: localStorage.getItem('skyflow_jwt') || null,
      email: localStorage.getItem('skyflow_email') || null,
      user: null,
      decodedJwt: null,
      tokenExpiryText: null
    },
    health: {
      gateway: { status: 'loading', latencyMs: null },
      auth: { status: 'loading', latencyMs: null },
      flights: { status: 'loading', latencyMs: null },
      bookings: { status: 'loading', latencyMs: null },
      reminder: { status: 'loading', latencyMs: null },
      rabbitmq: { status: 'loading', latencyMs: null, stats: null }
    },
    flights: [],
    cities: {},
    bookings: [],
    traceEvents: [],
    activeTrace: null,
    interviewMode: localStorage.getItem('skyflow_interview_mode') === 'true',
    e2eRunning: false,
    e2eResults: []
  };

  // Decode JWT if exists
  function parseJwt(token) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));
      return { header, payload };
    } catch (e) {
      return null;
    }
  }

  if (state.session.token) {
    state.session.decodedJwt = parseJwt(state.session.token);
  }

  function subscribe(key, fn) {
    if (!subscribers[key]) subscribers[key] = [];
    subscribers[key].push(fn);
    return () => {
      subscribers[key] = subscribers[key].filter(cb => cb !== fn);
    };
  }

  function emit(key) {
    if (subscribers[key]) {
      subscribers[key].forEach(fn => fn(state[key]));
    }
    if (subscribers['*']) {
      subscribers['*'].forEach(fn => fn(state));
    }
  }

  return {
    get: () => state,
    subscribe,

    setSession(token, email, user = null) {
      state.session.token = token;
      state.session.email = email;
      state.session.user = user;
      state.session.decodedJwt = parseJwt(token);
      if (token) {
        localStorage.setItem('skyflow_jwt', token);
        localStorage.setItem('skyflow_email', email);
      } else {
        localStorage.removeItem('skyflow_jwt');
        localStorage.removeItem('skyflow_email');
      }
      emit('session');
    },

    setHealth(newHealth) {
      state.health = { ...state.health, ...newHealth };
      emit('health');
    },

    setFlights(flights) {
      state.flights = flights;
      emit('flights');
    },

    setCities(cityMap) {
      state.cities = cityMap;
      emit('cities');
    },

    setBookings(bookings) {
      state.bookings = bookings;
      emit('bookings');
    },

    addTrace(event) {
      // Keep last 50 events
      state.traceEvents.unshift(event);
      if (state.traceEvents.length > 50) state.traceEvents.pop();
      state.activeTrace = event;
      emit('traceEvents');
    },

    setActiveTrace(event) {
      state.activeTrace = event;
      emit('activeTrace');
    },

    setInterviewMode(val) {
      state.interviewMode = !!val;
      localStorage.setItem('skyflow_interview_mode', state.interviewMode);
      emit('interviewMode');
    },

    setE2EResults(results, running = false) {
      state.e2eResults = results;
      state.e2eRunning = running;
      emit('e2eResults');
    }
  };
})();

window.State = State;
