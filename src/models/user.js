const { GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { dynamoDB } = require('../utils/dynamodb');

const TABLE = process.env.USERS_TABLE;
const SALT_ROUNDS = 12;

const UserModel = {
  async findByEmail(email) {
    // Emails are stored lowercase (see create()), so normalize here for case-insensitive lookup.
    const result = await dynamoDB.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email.toLowerCase() },
        Limit: 1,
      })
    );
    return result.Items?.[0] || null;
  },

  async findById(userId) {
    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLE, Key: { userId } })
    );
    return result.Item || null;
  },

  async create({ email, password, name }) {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    const user = {
      userId,
      email: email.toLowerCase(),
      name,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({ TableName: TABLE, Item: user }));

    // Return user without sensitive fields
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },

  async verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },

  sanitize(user) {
    const { passwordHash, ...safe } = user;
    return safe;
  },
};

module.exports = UserModel;
