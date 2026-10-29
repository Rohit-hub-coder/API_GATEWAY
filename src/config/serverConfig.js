const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 3004,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_KEY: process.env.JWT_KEY || 'auth',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || 'http://localhost:3002',
  FLIGHT_SERVICE_URL: process.env.FLIGHT_SERVICE_URL || 'http://localhost:3000',
  REMINDER_SERVICE_URL: process.env.REMINDER_SERVICE_URL || 'http://localhost:3003',
  RABBITMQ_MANAGEMENT_URL: process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672',
  RABBITMQ_USER: process.env.RABBITMQ_USER || 'guest',
  RABBITMQ_PASS: process.env.RABBITMQ_PASS || 'guest'
};
