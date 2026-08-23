const jwt = require('jsonwebtoken');
const { JWT_KEY } = require('../config/serverConfig');
const { StatusCodes } = require('http-status-codes');

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Unauthorized',
        explanation: 'Authorization header missing or invalid',
        data: {},
        success: false,
        err: {}
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Unauthorized',
        explanation: 'A valid Bearer token is required',
        data: {},
        success: false,
        err: {}
      });
    }

    const decoded = jwt.verify(token, JWT_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: 'Invalid or expired token',
      explanation: 'The supplied token could not be verified',
      data: {},
      success: false,
      err: {}
    });
  }
};

module.exports = verifyToken;
