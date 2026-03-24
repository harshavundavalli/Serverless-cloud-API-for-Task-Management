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

# Start local API (uses serverless-offline; DynamoDB Local recommended)
npm run dev
```

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
| `status` | string | | `todo` `in_progress` `done` `cancelled` |
| `priority` | string | | `low` `medium` `high` `urgent` |
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
| `priority` | String | `low` `medium` `high` `urgent` |
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
    └── tasks.test.js
```

---

## ⚙️ Environment Variables

| Variable | Description |
|----------|-------------|
| `TASKS_TABLE` | DynamoDB tasks table name |
| `USERS_TABLE` | DynamoDB users table name |
| `JWT_SECRET` | Secret for signing JWTs (use SSM in prod) |
| `STAGE` | `dev` / `prod` |

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
