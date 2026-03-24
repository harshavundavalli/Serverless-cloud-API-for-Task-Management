const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// When running locally via `npm run dev` (serverless-offline), point to DynamoDB Local
// instead of real AWS. IS_OFFLINE is set automatically by serverless-offline.
const isOffline = process.env.IS_OFFLINE || process.env.STAGE === 'local';

const client = new DynamoDBClient(
  isOffline
    ? { region: 'localhost', endpoint: 'http://localhost:8000' }
    : { region: process.env.AWS_REGION || 'us-east-1' }
);

// DynamoDBDocumentClient wraps the raw client and handles JS <-> DynamoDB type marshalling.
// removeUndefinedValues: true prevents errors when saving objects with optional undefined fields.
const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = { dynamoDB };
