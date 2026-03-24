// Mock AWS SDK before requiring any module that uses it
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

process.env.USERS_TABLE = 'test-users';
process.env.JWT_SECRET = 'test-secret';

const authHandler = require('../src/handlers/auth');

const makeEvent = (body) => ({ body: JSON.stringify(body) });

describe('POST /auth/register', () => {
  beforeEach(() => _mockSend.mockReset());

  it('returns 400 for invalid email', async () => {
    const res = await authHandler.register(makeEvent({ email: 'bad', password: 'Passw0rd', name: 'Alice' }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for weak password', async () => {
    const res = await authHandler.register(makeEvent({ email: 'a@b.com', password: 'weak', name: 'Alice' }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    _mockSend.mockResolvedValueOnce({ Items: [{ userId: 'existing', email: 'a@b.com' }] });
    const res = await authHandler.register(makeEvent({ email: 'a@b.com', password: 'Str0ngPass', name: 'Alice' }));
    expect(res.statusCode).toBe(409);
  });

  it('registers successfully and returns tokens', async () => {
    _mockSend
      .mockResolvedValueOnce({ Items: [] }) // findByEmail → not found
      .mockResolvedValueOnce({});            // PutCommand

    const res = await authHandler.register(makeEvent({ email: 'new@user.com', password: 'Str0ngPass', name: 'Bob' }));
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveProperty('accessToken');
    expect(body.data).toHaveProperty('refreshToken');
    expect(body.data.user).not.toHaveProperty('passwordHash');
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => _mockSend.mockReset());

  it('returns 401 for unknown email', async () => {
    _mockSend.mockResolvedValueOnce({ Items: [] });
    const res = await authHandler.login(makeEvent({ email: 'x@x.com', password: 'Passw0rd' }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('correct', 12);
    _mockSend.mockResolvedValueOnce({ Items: [{ userId: '1', email: 'a@b.com', passwordHash: hash }] });
    const res = await authHandler.login(makeEvent({ email: 'a@b.com', password: 'wrong' }));
    expect(res.statusCode).toBe(401);
  });
});
