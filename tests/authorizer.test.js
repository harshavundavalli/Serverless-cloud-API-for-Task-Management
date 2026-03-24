jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({}) },
}));
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn() }));

process.env.JWT_SECRET = 'test-secret';

const authorizer = require('../src/handlers/authorizer');
const { generateAccessToken } = require('../src/utils/jwt');

const makeEvent = (authorizationToken) => ({
  authorizationToken,
  methodArn: 'arn:aws:execute-api:us-east-1:123456789:abc/dev/GET/tasks',
});

describe('Lambda Authorizer', () => {
  it('denies when no token provided', async () => {
    const policy = await authorizer.handler(makeEvent(undefined));
    expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(policy.principalId).toBe('anonymous');
  });

  it('denies when Authorization header is malformed', async () => {
    const policy = await authorizer.handler(makeEvent('NotBearer token'));
    expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
  });

  it('denies when token is invalid', async () => {
    const policy = await authorizer.handler(makeEvent('Bearer bad.token.here'));
    expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
  });

  it('allows and returns userId in context when token is valid', async () => {
    const token = generateAccessToken({ userId: 'u1', email: 'a@b.com' });
    const policy = await authorizer.handler(makeEvent(`Bearer ${token}`));
    expect(policy.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(policy.principalId).toBe('u1');
    expect(policy.context.userId).toBe('u1');
    expect(policy.context.email).toBe('a@b.com');
  });
});
