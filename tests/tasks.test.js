jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    GetCommand: jest.fn(),
    PutCommand: jest.fn(),
    QueryCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    DeleteCommand: jest.fn(),
    _mockSend: mockSend,
  };
});
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn() }));

const { _mockSend } = require('@aws-sdk/lib-dynamodb');

process.env.TASKS_TABLE = 'test-tasks';

const tasksHandler = require('../src/handlers/tasks');

const makeEvent = (overrides = {}) => ({
  pathParameters: overrides.pathParameters || {},
  queryStringParameters: overrides.queryStringParameters || null,
  requestContext: { authorizer: { userId: 'user-123' } },
  ...overrides,
  body: JSON.stringify(overrides.body || {}),
});

describe('POST /tasks (create)', () => {
  beforeEach(() => _mockSend.mockReset());

  it('returns 400 when title is missing', async () => {
    const res = await tasksHandler.create(makeEvent({ body: { priority: 'high' } }));
    expect(res.statusCode).toBe(400);
  });

  it('creates a task and returns 201', async () => {
    _mockSend.mockResolvedValueOnce({}); // PutCommand
    const res = await tasksHandler.create(
      makeEvent({ body: { title: 'Buy milk', priority: 'low', dueDate: '2025-12-31' } })
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Buy milk');
    expect(body.data.priority).toBe('low');
  });
});

describe('GET /tasks/{taskId} (get)', () => {
  beforeEach(() => _mockSend.mockReset());

  it('returns 404 when task not found', async () => {
    _mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await tasksHandler.get(makeEvent({ pathParameters: { taskId: 'abc' } }));
    expect(res.statusCode).toBe(404);
  });

  it('returns the task when found', async () => {
    _mockSend.mockResolvedValueOnce({
      Item: { userId: 'user-123', taskId: 'abc', title: 'Test', status: 'todo', dueDate: 'none' },
    });
    const res = await tasksHandler.get(makeEvent({ pathParameters: { taskId: 'abc' } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.dueDate).toBeNull(); // 'none' normalized to null
  });
});

describe('DELETE /tasks/{taskId}', () => {
  beforeEach(() => _mockSend.mockReset());

  it('returns 404 when task does not exist', async () => {
    _mockSend.mockResolvedValueOnce({ Item: undefined });
    const res = await tasksHandler.delete(makeEvent({ pathParameters: { taskId: 'xyz' } }));
    expect(res.statusCode).toBe(404);
  });

  it('deletes and returns 204', async () => {
    _mockSend
      .mockResolvedValueOnce({ Item: { userId: 'user-123', taskId: 'xyz', dueDate: 'none' } })
      .mockResolvedValueOnce({});
    const res = await tasksHandler.delete(makeEvent({ pathParameters: { taskId: 'xyz' } }));
    expect(res.statusCode).toBe(204);
  });
});
