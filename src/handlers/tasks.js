const TaskModel = require('../models/task');
const {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  searchQuerySchema,
  validate,
} = require('../utils/validators');
const {
  ok,
  created,
  noContent,
  badRequest,
  forbidden,
  notFound,
  serverError,
} = require('../utils/response');
const logger = require('../utils/logger');

// Extract userId injected by the Lambda Authorizer.
// The path differs between REST API (authorizer.userId) and HTTP API (authorizer.lambda.userId).
const getUserId = (event) =>
  event.requestContext?.authorizer?.userId ||
  event.requestContext?.authorizer?.lambda?.userId;

// POST /tasks
exports.create = async (event) => {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    const { valid, data, errors } = validate(createTaskSchema, body);
    if (!valid) return badRequest('Validation failed', errors);

    const task = await TaskModel.create(userId, data);
    logger.info('Task created', { userId, taskId: task.taskId });
    return created(task);
  } catch (err) {
    logger.error('create task error', { err: err.message });
    return serverError();
  }
};

// GET /tasks
exports.list = async (event) => {
  try {
    const userId = getUserId(event);
    const query = event.queryStringParameters || {};
    const { valid, data, errors } = validate(listTasksQuerySchema, query);
    if (!valid) return badRequest('Invalid query parameters', errors);

    const result = await TaskModel.list(userId, data);
    return ok(result.items, {
      meta: { total: result.total, limit: data.limit },
    });
  } catch (err) {
    logger.error('list tasks error', { err: err.message });
    return serverError();
  }
};

// GET /tasks/{taskId}
exports.get = async (event) => {
  try {
    const userId = getUserId(event);
    const { taskId } = event.pathParameters;

    const task = await TaskModel.findById(userId, taskId);
    if (!task) return notFound('Task');

    if (task.userId !== userId) return forbidden();
    return ok(task);
  } catch (err) {
    logger.error('get task error', { err: err.message });
    return serverError();
  }
};

// PUT /tasks/{taskId}
exports.update = async (event) => {
  try {
    const userId = getUserId(event);
    const { taskId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');

    const { valid, data, errors } = validate(updateTaskSchema, body);
    if (!valid) return badRequest('Validation failed', errors);
    if (Object.keys(data).length === 0) return badRequest('No fields provided to update');

    // Verify ownership
    const existing = await TaskModel.findById(userId, taskId);
    if (!existing) return notFound('Task');

    const updated = await TaskModel.update(userId, taskId, data);
    logger.info('Task updated', { userId, taskId });
    return ok(updated);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return notFound('Task');
    logger.error('update task error', { err: err.message });
    return serverError();
  }
};

// DELETE /tasks/{taskId}
exports.delete = async (event) => {
  try {
    const userId = getUserId(event);
    const { taskId } = event.pathParameters;

    const existing = await TaskModel.findById(userId, taskId);
    if (!existing) return notFound('Task');

    await TaskModel.delete(userId, taskId);
    logger.info('Task deleted', { userId, taskId });
    return noContent();
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return notFound('Task');
    logger.error('delete task error', { err: err.message });
    return serverError();
  }
};

// GET /tasks/search?q=...
exports.search = async (event) => {
  try {
    const userId = getUserId(event);
    const query = event.queryStringParameters || {};
    const { valid, data, errors } = validate(searchQuerySchema, query);
    if (!valid) return badRequest('Invalid search query', errors);

    const results = await TaskModel.search(userId, data.q, data.limit);
    return ok(results, { meta: { query: data.q, count: results.length } });
  } catch (err) {
    logger.error('search tasks error', { err: err.message });
    return serverError();
  }
};
