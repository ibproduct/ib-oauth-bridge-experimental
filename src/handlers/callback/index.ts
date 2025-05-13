import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { storageService } from '../../services/storage';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Callback request:', {
    path: event.path,
    method: event.httpMethod,
    params: event.queryStringParameters
  });

  try {
    const params = event.queryStringParameters || {};
    const { code, state } = params;

    if (!code || !state) {
      console.log('Missing required parameters:', { params });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing authorization code'
        })
      };
    }

    try {
      // Get state entry to get original redirect URI
      console.log('Retrieving state for code:', code);
      const stateEntry = await storageService.getState(code);
      
      if (!stateEntry) {
        console.log('State entry not found for code:', code);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: 'Invalid authorization code'
          })
        };
      }

      // Redirect to client's callback URL with code and state
      console.log('Redirecting to client:', {
        redirectUri: stateEntry.redirectUri,
        code,
        state
      });

      return {
        statusCode: 302,
        headers: {
          'Location': `${stateEntry.redirectUri}?${new URLSearchParams({
            code,
            ...(state && { state })
          })}`,
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };

    } catch (error) {
      console.error('Error retrieving state:', error);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid authorization code'
        })
      };
    }

  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    };
  }
};