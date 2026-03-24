const UserModel = require('../models/user');
const { generateTokenPair, verifyRefreshToken, generateAccessToken } = require('../utils/jwt');
const { registerSchema, loginSchema, refreshSchema, validate } = require('../utils/validators');
const { ok, created, badRequest, unauthorized, conflict, serverError } = require('../utils/response');
const logger = require('../utils/logger');

// POST /auth/register
exports.register = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { valid, data, errors } = validate(registerSchema, body);
    if (!valid) return badRequest('Validation failed', errors);

    const existing = await UserModel.findByEmail(data.email);
    if (existing) return conflict('An account with this email already exists');

    const user = await UserModel.create(data);
    const tokens = generateTokenPair(user);

    logger.info('User registered', { userId: user.userId });
    return created({ user, ...tokens });
  } catch (err) {
    logger.error('register error', { err: err.message });
    return serverError();
  }
};

// POST /auth/login
exports.login = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { valid, data, errors } = validate(loginSchema, body);
    if (!valid) return badRequest('Validation failed', errors);

    const user = await UserModel.findByEmail(data.email);
    if (!user) return unauthorized('Invalid email or password');

    const passwordOk = await UserModel.verifyPassword(data.password, user.passwordHash);
    if (!passwordOk) return unauthorized('Invalid email or password');

    const tokens = generateTokenPair(user);
    const safeUser = UserModel.sanitize(user);

    logger.info('User logged in', { userId: user.userId });
    return ok({ user: safeUser, ...tokens });
  } catch (err) {
    logger.error('login error', { err: err.message });
    return serverError();
  }
};

// POST /auth/refresh
exports.refreshToken = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { valid, data, errors } = validate(refreshSchema, body);
    if (!valid) return badRequest('Validation failed', errors);

    const { valid: tokenValid, payload, error } = verifyRefreshToken(data.refreshToken);
    if (!tokenValid) return unauthorized(`Invalid refresh token: ${error}`);

    // Verify user still exists
    const user = await UserModel.findById(payload.userId);
    if (!user) return unauthorized('User no longer exists');

    const accessToken = generateAccessToken({ userId: user.userId, email: user.email });
    return ok({ accessToken, expiresIn: 900 });
  } catch (err) {
    logger.error('refreshToken error', { err: err.message });
    return serverError();
  }
};
