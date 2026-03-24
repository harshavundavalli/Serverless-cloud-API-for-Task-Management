const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Content-Type': 'application/json',
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body),
});

const ok = (data, meta = {}) =>
  response(200, { success: true, data, ...meta });

const created = (data) =>
  response(201, { success: true, data });

const noContent = () => ({
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
});

const badRequest = (message, errors = null) =>
  response(400, { success: false, message, ...(errors && { errors }) });

const unauthorized = (message = 'Unauthorized') =>
  response(401, { success: false, message });

const forbidden = (message = 'Forbidden') =>
  response(403, { success: false, message });

const notFound = (resource = 'Resource') =>
  response(404, { success: false, message: `${resource} not found` });

const conflict = (message) =>
  response(409, { success: false, message });

const serverError = (message = 'Internal server error') =>
  response(500, { success: false, message });

module.exports = {
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
};
