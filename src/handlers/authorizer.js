const { verifyAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Lambda Authorizer — validates the Bearer token and returns an IAM policy.
 * API Gateway caches the result per token for 5 minutes by default.
 *
 * Flow: extract token → verify JWT → return Allow or Deny IAM policy.
 * The `context` object on an Allow policy is forwarded to the downstream Lambda
 * as event.requestContext.authorizer, making userId available without a DB lookup.
 */
exports.handler = async (event) => {
  try {
    const token = extractToken(event);
    if (!token) return generatePolicy('anonymous', 'Deny', event.methodArn);

    const { valid, payload, error } = verifyAccessToken(token);
    if (!valid) {
      logger.warn('JWT verification failed', { error });
      return generatePolicy('anonymous', 'Deny', event.methodArn);
    }

    logger.info('Authorized', { userId: payload.userId });

    const policy = generatePolicy(payload.userId, 'Allow', event.methodArn);
    // Attach userId and email to the policy context so downstream handlers
    // can read them from event.requestContext.authorizer without re-verifying the token.
    policy.context = {
      userId: payload.userId,
      email: payload.email,
    };
    return policy;
  } catch (err) {
    logger.error('Authorizer error', { err: err.message });
    return generatePolicy('anonymous', 'Deny', event.methodArn);
  }
};

function extractToken(event) {
  const header =
    event.authorizationToken || event.headers?.Authorization || event.headers?.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

function generatePolicy(principalId, effect, resource) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}
