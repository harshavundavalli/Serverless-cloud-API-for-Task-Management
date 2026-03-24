# CLAUDE.md — Task Management API

## Project Overview
Serverless REST API for task management built on AWS Lambda + API Gateway + DynamoDB.
Node.js 18, Serverless Framework v3, JWT auth, Zod validation.

## Commands
```bash
npm test              # run Jest tests (no AWS/Docker needed)
npm run test:watch    # watch mode
npm run dev           # start local server at http://localhost:3000 (requires DynamoDB Local)
npm run deploy        # deploy to AWS dev stage
npm run deploy:prod   # deploy to AWS prod stage
```

## Architecture
```
API Gateway → Lambda Authorizer (JWT) → Handler → Model → DynamoDB
```
- `/auth/*` — public, no auth required (`src/handlers/auth.js`)
- `/tasks/*` — protected, JWT validated first by `src/handlers/authorizer.js`
- The authorizer injects `userId` into `event.requestContext.authorizer` so handlers don't re-verify the token

## Project Structure
```
src/
  handlers/
    auth.js         # POST /auth/register, /login, /refresh
    tasks.js        # CRUD + search for tasks
    authorizer.js   # Lambda JWT authorizer (called by API Gateway before task handlers)
  models/
    user.js         # DynamoDB user operations
    task.js         # DynamoDB task operations
  utils/
    dynamodb.js     # DynamoDB client (auto-switches to localhost:8000 when IS_OFFLINE=true)
    jwt.js          # Token generation & verification
    validators.js   # Zod schemas for all endpoints
    response.js     # HTTP response helpers (ok, created, notFound, etc.)
    logger.js       # Structured JSON logs in prod, colorized in dev
tests/
  auth.test.js
  tasks.test.js
  authorizer.test.js
```

## Non-obvious Conventions

### DynamoDB `dueDate: 'none'` sentinel
DynamoDB GSI sort keys cannot be null or missing. When a task has no due date, it is stored
as the string `"none"`. `TaskModel._normalize()` converts `"none"` back to `null` before
returning data to API consumers. Always use `_normalize()` on items coming out of DynamoDB.

### JWT uses two separate secrets
- Access tokens: signed with `JWT_SECRET`
- Refresh tokens: signed with `JWT_SECRET + '-refresh'`

This means a refresh token cannot be accepted where an access token is expected.

### Over-fetch pattern in `TaskModel.list()`
DynamoDB can only filter on indexed keys. Priority and date-range filters are applied
in-memory after fetching. To compensate, the query fetches `limit * 3` items from DynamoDB
before client-side filtering, then slices to the requested `limit`.

### Pagination cursor
`lastKey` is a base64-encoded JSON string of DynamoDB's `LastEvaluatedKey`. It is decoded
in `TaskModel.list()` and passed as `ExclusiveStartKey` to resume pagination.

### `getUserId` has two paths
REST API and HTTP API have different shapes for the authorizer context:
- REST API: `event.requestContext.authorizer.userId`
- HTTP API: `event.requestContext.authorizer.lambda.userId`

### Update expression is built dynamically
`TaskModel.update()` constructs the DynamoDB `SET` expression at runtime from whatever
fields are present in the update payload. Adding a new updatable field requires no changes
to the query logic — just allow it through the Zod `updateTaskSchema`.

## Environment Variables
| Variable | Description |
|---|---|
| `TASKS_TABLE` | DynamoDB tasks table name |
| `USERS_TABLE` | DynamoDB users table name |
| `JWT_SECRET` | Secret for signing JWTs (use SSM in prod) |
| `STAGE` | `dev` / `prod` — controls log format and DynamoDB endpoint |
| `IS_OFFLINE` | Set by serverless-offline; switches DynamoDB to localhost:8000 |

Copy `.env.example` to `.env` for local development. Never commit `.env`.

## Local Dev Setup
```bash
docker run -p 8000:8000 amazon/dynamodb-local   # DynamoDB Local
cp .env.example .env
npm install
npm run dev
```

## Testing Approach
- Tests use Jest with mocked AWS SDK (`@aws-sdk/lib-dynamodb`)
- No real AWS credentials or DynamoDB needed to run tests
- `makeEvent()` helpers in each test file simulate API Gateway Lambda event shapes
- Auth tests mock `_mockSend` to control DynamoDB responses per test

## Deployment
JWT secret must exist in SSM before deploying:
```bash
aws ssm put-parameter --name /task-api/dev/jwt-secret --value "..." --type SecureString
aws ssm put-parameter --name /task-api/prod/jwt-secret --value "..." --type SecureString
```
CI/CD auto-deploys on push to `main` via `.github/workflows/deploy.yml`.
Requires `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set as GitHub repository secrets.

## What NOT to Do
- Do not store `null` as a DynamoDB attribute for `dueDate` — use `'none'`
- Do not use access tokens where refresh tokens are expected or vice versa (different secrets)
- Do not add filtering logic in DynamoDB queries for `priority` or date range — these are
  applied client-side after fetching; filter in the JS layer in `TaskModel.list()`
- Do not commit `.env` — it contains secrets
- Do not skip `_normalize()` when returning task items — callers expect `null`, not `'none'`
