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
import { ibClient } from '../../services/ib-client';

const tokenService = new TokenService();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate request body
    if (!event.body) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Missing request body'
      ));
    }

    const params = JSON.parse(event.body);
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
    // Get state entry using code
    const stateEntry = await storageService.getState(code);

    // Validate client_id and redirect_uri match stored values
    if (stateEntry.clientId !== clientId || stateEntry.redirectUri !== redirectUri) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'client_id or redirect_uri mismatch'
      ));
    }

    // Get IB session info using stored token
    const sessionInfo = await ibClient.getSessionInfo(stateEntry.ibToken);

    // Generate OAuth tokens
    const tokens = await tokenService.generateTokens({
      sub: sessionInfo.session.user.id,
      name: `${sessionInfo.session.user.firstName} ${sessionInfo.session.user.lastName}`,
      email: sessionInfo.session.user.email,
      scope: stateEntry.scope
    });

    // Store token mapping
    await storageService.storeToken(
      tokens.access_token,
      tokens.refresh_token,
      clientId,
      stateEntry.scope,
      sessionInfo.session.id
    );

    // Delete used state entry
    await storageService.deleteState(code);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokens)
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('state')) {
      return errorResponse(createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Invalid or expired authorization code'
      ));
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

    // Get current IB session info
    const sessionInfo = await ibClient.getSessionInfo(tokenEntry.ibSid);

    // Generate new tokens
    const tokens = await tokenService.generateTokens({
      sub: sessionInfo.session.user.id,
      name: `${sessionInfo.session.user.firstName} ${sessionInfo.session.user.lastName}`,
      email: sessionInfo.session.user.email,
      scope: tokenEntry.scope
    });

    // Store new token mapping
    await storageService.storeToken(
      tokens.access_token,
      tokens.refresh_token,
      clientId,
      tokenEntry.scope,
      sessionInfo.session.id
    );

    // Delete old token entry
    await storageService.deleteToken(tokenEntry.accessToken);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokens)
    };
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
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(error)
  };
}