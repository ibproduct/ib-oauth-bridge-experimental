import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { storageService } from '../../services/storage';
import { IBSessionInfo } from '../../services/ib-client';
import { extractBearerToken, createOAuthError, OAuthErrorType } from '../../utils/oauth';

/**
 * Add CORS headers to successful responses
 */
interface UserinfoResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  email?: string;
  updated_at: number;
  ib_client_id: string;
  ib_api_url: string;
  ib_user_uuid: string;
  ib_session_id: string;
}

function successResponse(body: UserinfoResponse): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Create error response
 */
function errorResponse(error: ReturnType<typeof createOAuthError>, statusCode: number = 400): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(error)
  };
}

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  console.log('Userinfo request:', {
    method: event.httpMethod,
    headers: event.headers,
    path: event.path
  });

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    };
  }

  try {
    // Extract and validate access token
    const accessToken = extractBearerToken(event.headers);
    if (!accessToken) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_TOKEN,
        'Missing or invalid access token'
      ));
    }

    // Get token entry from storage
    const tokenEntry = await storageService.getToken(accessToken);

    // Extract user info from stored token data
    // Ensure content is the correct type and not just the initial auth response
    if (typeof tokenEntry.ibToken.content === 'string') {
      return errorResponse(createOAuthError(
        OAuthErrorType.SERVER_ERROR,
        'Invalid token content format'
      ));
    }

    const sessionContent = tokenEntry.ibToken.content as IBSessionInfo['content'];

    // Format response with stored user information
    const userInfo = {
      // Standard OpenID Connect claims
      sub: sessionContent.session.userUuid,
      name: `${sessionContent.info.firstname} ${sessionContent.info.lastname}`,
      given_name: sessionContent.info.firstname,
      family_name: sessionContent.info.lastname,
      email: sessionContent.info.email,
      updated_at: Math.floor(sessionContent.session.loginTime / 1000),
      
      // Additional IB-specific claims
      ib_client_id: sessionContent.info.clientid,
      ib_api_url: sessionContent.info.apiV3url,
      ib_user_uuid: sessionContent.info.useruuid,
      ib_session_id: sessionContent.session.sid
    };

    return successResponse(userInfo);
  } catch (error) {
    console.error('Userinfo error:', error);

    if (error instanceof Error && error.message === 'Invalid access token') {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_TOKEN,
        'Access token is invalid or has expired'
      ));
    }

    return errorResponse(createOAuthError(
      OAuthErrorType.SERVER_ERROR,
      'An error occurred while processing the request'
    ));
  }
};