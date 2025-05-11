import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TokenService } from '../../services/token';
import { storageService } from '../../services/storage';
import { ibClient } from '../../services/ib-client';

const tokenService = new TokenService();

interface UserInfoResponse {
  sub: string;           // Subject identifier
  name?: string;         // Full name
  given_name?: string;   // First name
  family_name?: string;  // Last name
  email?: string;        // Email address
  email_verified?: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract Bearer token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Missing or invalid Authorization header');
    }

    const accessToken = authHeader.substring(7);

    // Validate JWT token (will throw if invalid)
    await tokenService.validateToken(accessToken);

    // Get token mapping from storage
    const tokenEntry = await storageService.getToken(accessToken);

    // Get current IB session info
    const sessionInfo = await ibClient.getSessionInfo(tokenEntry.ibSid);

    // Map IB profile to standard OAuth claims
    const userInfo: UserInfoResponse = {
      sub: sessionInfo.session.user.id,
      name: `${sessionInfo.session.user.firstName} ${sessionInfo.session.user.lastName}`,
      given_name: sessionInfo.session.user.firstName,
      family_name: sessionInfo.session.user.lastName,
      email: sessionInfo.session.user.email,
      email_verified: true // IB emails are verified during account creation
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userInfo)
    };

  } catch (error) {
    if (error instanceof Error) {
      // Token validation errors
      if (error.message.includes('Token validation failed')) {
        return errorResponse(401, 'Invalid token');
      }
      
      // Token storage errors
      if (error.message.includes('Invalid access token') || 
          error.message.includes('Access token has expired')) {
        return errorResponse(401, 'Token expired or invalid');
      }

      // IB API errors
      if (error.message.includes('Failed to get session')) {
        return errorResponse(401, 'Invalid session');
      }

      // Log unexpected errors
      console.error('UserInfo Error:', error);
      return errorResponse(500, 'Internal server error');
    }

    return errorResponse(500, 'An unexpected error occurred');
  }
};

/**
 * Create error response
 */
function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer error="invalid_token"'
    },
    body: JSON.stringify({
      error: message
    })
  };
}