# 📋 Task Management API — Serverless on AWS

A production-ready, fully serverless REST API for task management built on **AWS Lambda + API Gateway + DynamoDB**. Features JWT authentication, full CRUD, filtering, search, and priority/due-date management.

---

## 🏗️ Architecture

```
Client
  │
  ▼
API Gateway (REST)
  │
  ├─ /auth/*          → Lambda (auth.js)       ← no auth required
  │
  ├─ /tasks/*         → Lambda Authorizer      ← validates JWT
  │       │               (authorizer.js)
  │       ▼
  │    Lambda (tasks.js)
  │
  └─ DynamoDB
       ├─ TasksTable   (PK: userId, SK: taskId)
       │    ├─ GSI: StatusIndex  (userId + status)
       │    └─ GSI: DueDateIndex (userId + dueDate)
       └─ UsersTable  (PK: userId)
            └─ GSI: EmailIndex  (email)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured (`aws configure`)
- Serverless Framework v3 (`npm i -g serverless`)

### Install & run locally

```bash
npm install
cp .env.example .env

# 1. Start DynamoDB Local (requires Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# 2. Create tables (run in a new terminal)
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb create-table \
  --table-name task-management-api-users-dev \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=email,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"EmailIndex","KeySchema":[{"AttributeName":"email","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --endpoint-url http://localhost:8000 --region localhost

AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb create-table \
  --table-name task-management-api-tasks-dev \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=taskId,AttributeType=S AttributeName=status,AttributeType=S AttributeName=dueDate,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=taskId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"StatusIndex","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"status","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"DueDateIndex","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"dueDate","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --endpoint-url http://localhost:8000 --region localhost

# 3. Start the API server
npm run dev
```

The API runs at `http://localhost:3000`. Open `public/index.html` in your browser for the frontend UI.

### Deploy to AWS

```bash
# Dev
npm run deploy

# Production
npm run deploy:prod
```

---

## 📡 API Reference

### Authentication

All task endpoints require `Authorization: Bearer <accessToken>` header.

#### `POST /auth/register`
```json
{
  "email": "alice@example.com",
  "password": "Str0ngPass",
  "name": "Alice"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "userId": "...", "email": "...", "name": "..." },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 900
  }
}
```

#### `POST /auth/login`
```json
{ "email": "alice@example.com", "password": "Str0ngPass" }
```

#### `POST /auth/refresh`
```json
{ "refreshToken": "<refresh_jwt>" }
```

---

### Tasks

#### `POST /tasks` — Create a task
```json
{
  "title": "Fix critical bug",
  "description": "Reproduce and patch the auth race condition",
  "status": "todo",
  "priority": "urgent",
  "dueDate": "2025-03-15",
  "tags": ["backend", "security"]
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `title` | string | ✅ | 1–200 chars |
| `description` | string | | max 2000 chars |
| `status` | string | | `todo` `in-progress` `completed` |
| `priority` | string | | `low` `medium` `high` |
| `dueDate` | string | | `YYYY-MM-DD` |
| `tags` | string[] | | max 10 items |

#### `GET /tasks` — List tasks (with filtering)

Query parameters:

| Param | Description |
|-------|-------------|
| `status` | Filter by status |
| `priority` | Filter by priority |
| `dueBefore` | `YYYY-MM-DD` upper bound |
| `dueAfter` | `YYYY-MM-DD` lower bound |
| `sortBy` | `createdAt` \| `dueDate` \| `priority` |
| `order` | `asc` \| `desc` |
| `limit` | 1–100 (default 20) |
| `lastKey` | Pagination cursor |

#### `GET /tasks/{taskId}` — Get single task
#### `PUT /tasks/{taskId}` — Update task (partial update supported)
#### `DELETE /tasks/{taskId}` — Delete task (returns 204)

#### `GET /tasks/search?q=keyword` — Full-text search
Searches across `title`, `description`, and `tags`.

---

## 🔒 Security

- Passwords hashed with **bcrypt** (12 rounds)
- **Access tokens** expire in 15 minutes; **refresh tokens** in 7 days
- JWT secret stored in **AWS SSM Parameter Store** in production
- Lambda Authorizer result cached for 5 min to reduce cold starts
- All user data is **tenant-isolated** — DynamoDB partition key is `userId`
- Input validated with **Zod** schemas on every endpoint

---

## 🗃️ DynamoDB Design

### TasksTable

| Attribute | Type | Notes |
|-----------|------|-------|
| `userId` | String | Partition key — owner |
| `taskId` | String | Sort key — UUID |
| `title` | String | |
| `status` | String | GSI sort key (StatusIndex) |
| `dueDate` | String | GSI sort key (DueDateIndex); `"none"` when null |
| `priority` | String | `low` `medium` `high` |
| `tags` | List | |
| `createdAt` | String | ISO 8601 |
| `updatedAt` | String | ISO 8601 |

---

## 🧪 Testing

```bash
npm test            # run all tests with coverage
npm run test:watch  # watch mode
```

---

## 📁 Project Structure

```
task-api/
├── serverless.yml          # Infrastructure as code
├── package.json
├── .env.example
├── public/
│   └── index.html          # Browser frontend UI
├── src/
│   ├── handlers/
│   │   ├── auth.js         # register / login / refresh
│   │   ├── tasks.js        # CRUD + search
│   │   └── authorizer.js   # Lambda JWT authorizer
│   ├── models/
│   │   ├── user.js         # DynamoDB user operations
│   │   └── task.js         # DynamoDB task operations
│   └── utils/
│       ├── dynamodb.js     # DynamoDB client
│       ├── jwt.js          # Token generation & verification
│       ├── validators.js   # Zod schemas
│       ├── response.js     # HTTP response helpers
│       └── logger.js       # Structured logging (CloudWatch)
└── tests/
    ├── auth.test.js
    ├── tasks.test.js
    └── authorizer.test.js
```

---

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `TASKS_TABLE` | DynamoDB tasks table name |
| `USERS_TABLE` | DynamoDB users table name |
| `JWT_SECRET` | Secret for signing JWTs (use SSM in prod) |
| `STAGE` | `dev` / `prod` |
| `IS_OFFLINE` | Set by serverless-offline; switches DynamoDB to localhost:8000 |
| `AWS_REGION` | AWS region (default: `us-east-1`) |

---

## 🔧 Production Checklist

- [ ] Store `JWT_SECRET` in SSM: `aws ssm put-parameter --name /task-api/prod/jwt-secret --value "..." --type SecureString`
- [ ] Enable DynamoDB Point-in-Time Recovery (PITR)
- [ ] Set up CloudWatch Alarms for Lambda errors and throttles
- [ ] Enable AWS WAF on API Gateway for rate limiting
- [ ] Add X-Ray tracing for distributed tracing
- [ ] Configure custom domain via Route 53 + ACM

---

## 📄 License

MIT
