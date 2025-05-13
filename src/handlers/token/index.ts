import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import {
  validateTokenParams,
  createOAuthError,
  OAuthErrorType,
  GrantType
} from '../../utils/oauth';
import { TokenService } from '../../services/token';
import { storageService } from '../../services/storage';

const tokenService = new TokenService();

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  platform_url?: string;
  client_id?: string;
  sid?: string;
}

/**
 * Add CORS headers to successful responses
 */
function successResponse(body: TokenResponse): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Token request:', {
    body: event.body,
    headers: event.headers,
    method: event.httpMethod
  });

  try {
    // Parse and validate request body
    if (!event.body) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Missing request body'
      ));
    }

    // Parse form-urlencoded or JSON body
    // Always parse as form data since that's what OAuth spec requires
    const params = Object.fromEntries(new URLSearchParams(event.body));
    console.log('Parsed form data:', params);
    const validatedParams = validateTokenParams(params);

    // Handle different grant types
    if (validatedParams.grant_type === GrantType.AUTHORIZATION_CODE) {
      return handleAuthorizationCode(
        validatedParams.code!,
        validatedParams.redirect_uri!,
        validatedParams.client_id
      );
    } else {
      return handleRefreshToken(
        validatedParams.refresh_token!,
        validatedParams.client_id
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Invalid request parameters'
      ));
    }

    if (error instanceof Error) {
      return errorResponse(createOAuthError(
        OAuthErrorType.SERVER_ERROR,
        error.message
      ));
    }

    return errorResponse(createOAuthError(
      OAuthErrorType.SERVER_ERROR,
      'An unexpected error occurred'
    ));
  }
};

/**
 * Handle authorization code grant type
 */
async function handleAuthorizationCode(
  code: string,
  redirectUri: string,
  clientId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Get state entry using code as key
    const stateEntry = await storageService.getState(code);
    console.log('Retrieved state for code:', {
      code,
      hasState: !!stateEntry,
      clientId: stateEntry?.clientId,
      hasIbToken: !!stateEntry?.ibToken
    });

    // Validate client_id and redirect_uri match stored values
    if (stateEntry.clientId !== clientId || stateEntry.redirectUri !== redirectUri) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'client_id or redirect_uri mismatch'
      ));
    }

    // Generate OAuth tokens using stored info
    const tokens = await tokenService.generateTokens({
      sub: stateEntry.ibToken.sid,
      scope: stateEntry.scope
    });

    // Store token mapping
    // Store token with the same IB token for session info
    await storageService.storeToken(
      tokens.access_token,
      tokens.refresh_token,
      clientId,
      stateEntry.scope,
      stateEntry.ibToken,
      stateEntry.platformUrl
    );

    // Delete used state entry
    await storageService.deleteState(code);

    // Get API info from stored token
    const apiInfo = stateEntry.ibToken.content as { apiV3url: string, clientid: string };

    return successResponse({
      ...tokens,
      platform_url: apiInfo.apiV3url,
      client_id: apiInfo.clientid,
      sid: stateEntry.ibToken.sid
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('state')) {
        return errorResponse(createOAuthError(
          OAuthErrorType.INVALID_REQUEST,
          'Invalid or expired authorization code'
        ));
      }
      if (error.message === 'Authentication pending' || error.message === 'Authentication timeout') {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          },
          body: JSON.stringify({
            error: error.message === 'Authentication timeout' ? 'authorization_timeout' : 'authorization_pending',
            error_description: error.message === 'Authentication timeout'
              ? 'The authorization request has timed out'
              : 'The authorization request is still pending'
          })
        };
      }
    }
    throw error;
  }
}

/**
 * Handle refresh token grant type
 */
async function handleRefreshToken(
  refreshToken: string,
  clientId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Get stored token entry
    const tokenEntry = await storageService.getTokenByRefreshToken(refreshToken);

    // Validate client_id matches stored value
    if (tokenEntry.clientId !== clientId) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'client_id mismatch'
      ));
    }

    // Generate new tokens using stored info
    const tokens = await tokenService.generateTokens({
      sub: tokenEntry.ibToken.sid,
      scope: tokenEntry.scope
    });

    // Store new token mapping
    // Store token with the same IB token for session info
    await storageService.storeToken(
      tokens.access_token,
      tokens.refresh_token,
      clientId,
      tokenEntry.scope,
      tokenEntry.ibToken,
      tokenEntry.platformUrl
    );

    // Delete old token entry
    await storageService.deleteToken(tokenEntry.accessToken);

    // Get API info from stored token
    const apiInfo = tokenEntry.ibToken.content as { apiV3url: string, clientid: string };

    return successResponse({
      ...tokens,
      platform_url: apiInfo.apiV3url,
      client_id: apiInfo.clientid,
      sid: tokenEntry.ibToken.sid
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('refresh token')) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Invalid or expired refresh token'
      ));
    }
    throw error;
  }
}

/**
 * Create error response
 */
function errorResponse(error: ReturnType<typeof createOAuthError>): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(error)
  };
}