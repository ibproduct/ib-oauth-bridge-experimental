import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { storageService } from '../../services/storage';
import { ibClient } from '../../services/ib-client';
import { tokenService } from '../../services/token';
import { createOAuthError, OAuthErrorType } from '../../utils/oauth';
import axios from 'axios';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(headers: { [key: string]: string | undefined }): string {
  console.log('Received headers:', headers);
  
  // Find Authorization header case-insensitively
  const headerKey = Object.keys(headers).find(
    key => key.toLowerCase() === 'authorization'
  );
  const authHeader = headerKey ? headers[headerKey] : undefined;
  
  console.log('Found Authorization header:', authHeader);
  
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  return authHeader.substring(7);
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: APIGatewayProxyResult): APIGatewayProxyResult {
  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  };
}

/**
 * Create error response
 */
function errorResponse(error: ReturnType<typeof createOAuthError>): APIGatewayProxyResult {
  return addCorsHeaders({
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(error)
  });
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Proxy request:', {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
    pathParameters: event.pathParameters
  });

  try {
    // Extract and validate Bearer token
    const accessToken = extractBearerToken(event.headers);
    const tokenEntry = await storageService.getToken(accessToken);

    // Check if session needs refresh
    if (await tokenService.needsSessionRefresh(tokenEntry)) {
      try {
        // Validate refresh attempt
        await tokenService.validateRefreshAttempt(tokenEntry);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Maximum refresh attempts exceeded') {
            return errorResponse(createOAuthError(
              OAuthErrorType.INVALID_TOKEN,
              'Session refresh limit exceeded'
            ));
          }
          if (error.message === 'Session maximum age exceeded') {
            return errorResponse(createOAuthError(
              OAuthErrorType.INVALID_TOKEN,
              'Session has expired'
            ));
          }
        }
        throw error;
      }
    }

    // Get proxy path from event
    const path = event.pathParameters?.proxy;
    if (!path) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Missing proxy path'
      ));
    }

    // Forward request to IB API
    try {
      // Create clean headers for the proxy request
      const headers: Record<string, string> = {
        'sid': tokenEntry.ibToken.sid,
        'Content-Type': 'application/json'
      };

      const targetUrl = `https://${path}`;
      console.log('Making proxy request to:', targetUrl);

      const response = await ibClient.proxyRequest({
        method: event.httpMethod,
        url: targetUrl,
        headers,
        body: event.body || undefined,
        sid: tokenEntry.ibToken.sid
      });

      return addCorsHeaders({
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(response.data)
      });
    } catch (error) {
      // Handle IB API errors
      if (axios.isAxiosError(error) && error.response) {
        return addCorsHeaders({
          statusCode: error.response.status,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(error.response.data)
        });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Authorization header')) {
        return errorResponse(createOAuthError(
          OAuthErrorType.INVALID_REQUEST,
          'Missing or invalid Authorization header'
        ));
      }
      if (error.message.includes('token')) {
        return errorResponse(createOAuthError(
          OAuthErrorType.INVALID_TOKEN,
          'Invalid or expired access token'
        ));
      }
    }

    console.error('Proxy error:', error);
    return errorResponse(createOAuthError(
      OAuthErrorType.SERVER_ERROR,
      'An unexpected error occurred'
    ));
  }
};