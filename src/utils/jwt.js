const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, JWT_SECRET + '-refresh', { expiresIn: REFRESH_TOKEN_EXPIRY });

const verifyAccessToken = (token) => {
  try {
    return { valid: true, payload: jwt.verify(token, JWT_SECRET) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

const verifyRefreshToken = (token) => {
  try {
    return { valid: true, payload: jwt.verify(token, JWT_SECRET + '-refresh') };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

const generateTokenPair = (user) => {
  const payload = { userId: user.userId, email: user.email };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: 900, // 15 minutes in seconds
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
};
