const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const isOffline = process.env.IS_OFFLINE || process.env.STAGE === 'local';

const client = new DynamoDBClient(
  isOffline
    ? { region: 'localhost', endpoint: 'http://localhost:8000' }
    : { region: process.env.AWS_REGION || 'us-east-1' }
);

const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = { dynamoDB };
