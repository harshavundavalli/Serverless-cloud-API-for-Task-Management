const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB } = require('../utils/dynamodb');

const TABLE = process.env.TASKS_TABLE;

// Priority sort weights for in-memory sorting
const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };

const TaskModel = {
  async create(userId, taskData) {
    const taskId = uuidv4();
    const now = new Date().toISOString();

    const task = {
      userId,
      taskId,
      ...taskData,
      dueDate: taskData.dueDate || 'none', // DynamoDB GSI key can't be null
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({ TableName: TABLE, Item: task }));
    return this._normalize(task);
  },

  async findById(userId, taskId) {
    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLE, Key: { userId, taskId } })
    );
    return result.Item ? this._normalize(result.Item) : null;
  },

  async list(userId, { status, priority, dueBefore, dueAfter, limit, lastKey, sortBy, order }) {
    let items = [];

    // Use GSI when filtering by status for efficiency
    if (status) {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: 'StatusIndex',
          KeyConditionExpression: 'userId = :uid AND #s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':uid': userId, ':status': status },
          ScanIndexForward: order === 'asc',
          Limit: limit * 3, // over-fetch to allow client-side filtering
          ...(lastKey && { ExclusiveStartKey: JSON.parse(Buffer.from(lastKey, 'base64').toString()) }),
        })
      );
      items = result.Items || [];
    } else {
      const result = await dynamoDB.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
          ScanIndexForward: order === 'asc',
          Limit: limit * 3,
          ...(lastKey && { ExclusiveStartKey: JSON.parse(Buffer.from(lastKey, 'base64').toString()) }),
        })
      );
      items = result.Items || [];
    }

    // Client-side filtering for priority and date range
    if (priority) items = items.filter((t) => t.priority === priority);
    if (dueBefore) items = items.filter((t) => t.dueDate !== 'none' && t.dueDate <= dueBefore);
    if (dueAfter) items = items.filter((t) => t.dueDate !== 'none' && t.dueDate >= dueAfter);

    // Sort
    items.sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1;
      if (sortBy === 'priority') {
        return dir * ((PRIORITY_WEIGHT[a.priority] || 0) - (PRIORITY_WEIGHT[b.priority] || 0));
      }
      if (sortBy === 'dueDate') {
        const da = a.dueDate === 'none' ? '9999' : a.dueDate;
        const db = b.dueDate === 'none' ? '9999' : b.dueDate;
        return dir * da.localeCompare(db);
      }
      return dir * a.createdAt.localeCompare(b.createdAt);
    });

    const paginated = items.slice(0, limit);
    return {
      items: paginated.map(this._normalize.bind(this)),
      total: items.length,
    };
  },

  async update(userId, taskId, updates) {
    const now = new Date().toISOString();

    // Build update expression dynamically
    const fields = { ...updates, updatedAt: now };
    if (updates.dueDate === null) fields.dueDate = 'none';

    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = { ':uid': userId };
    const setParts = [];

    for (const [key, val] of Object.entries(fields)) {
      const nameKey = `#${key}`;
      const valKey = `:${key}`;
      ExpressionAttributeNames[nameKey] = key;
      ExpressionAttributeValues[valKey] = val;
      setParts.push(`${nameKey} = ${valKey}`);
    }

    const result = await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { userId, taskId },
        UpdateExpression: `SET ${setParts.join(', ')}`,
        ConditionExpression: 'userId = :uid',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return this._normalize(result.Attributes);
  },

  async delete(userId, taskId) {
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { userId, taskId },
        ConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      })
    );
    return true;
  },

  async search(userId, query, limit) {
    // Scan all user tasks then filter (for large datasets, consider OpenSearch)
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      })
    );

    const q = query.toLowerCase();
    const matched = (result.Items || [])
      .filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
      .slice(0, limit);

    return matched.map(this._normalize.bind(this));
  },

  // Normalize stored "none" dueDate back to null for API consumers
  _normalize(task) {
    if (!task) return null;
    return {
      ...task,
      dueDate: task.dueDate === 'none' ? null : task.dueDate,
    };
  },
};

module.exports = TaskModel;
