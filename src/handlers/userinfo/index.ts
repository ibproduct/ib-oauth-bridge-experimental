import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (_event) => {
  // TODO: Implement user info endpoint
  return {
    statusCode: 501,
    body: JSON.stringify({
      error: 'not_implemented',
      error_description: 'User info endpoint not yet implemented'
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};