import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { ibClient } from '../../services/ib-client';
import { storageService } from '../../services/storage';
import { 
  createOAuthError, 
  generateErrorRedirect,
  generateAuthCodeRedirect,
  OAuthErrorType,
  BaseAuthorizeParamsSchema
} from '../../utils/oauth';
import * as fs from 'fs';
import * as path from 'path';

// Read HTML template
const FORM_HTML = fs.readFileSync(
  path.join(__dirname, 'platform-form.html'),
  'utf8'
);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle different endpoints
    if (event.path === '/authorize/start') {
      return handleStartLogin(event);
    } else if (event.path === '/authorize/poll') {
      return handlePollLogin(event);
    }

    // Main authorize endpoint - show form
    const params = event.queryStringParameters || {};

    // First validate base OAuth parameters
    try {
      BaseAuthorizeParamsSchema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        if (!params.redirect_uri) {
          return {
            statusCode: 400,
            body: JSON.stringify(
              createOAuthError(
                OAuthErrorType.INVALID_REQUEST,
                'Invalid request parameters'
              )
            )
          };
        }

        return {
          statusCode: 302,
          headers: {
            Location: generateErrorRedirect(params.redirect_uri, createOAuthError(
              OAuthErrorType.INVALID_REQUEST,
              'Invalid request parameters',
              params.state
            ))
          },
          body: ''
        };
      }
      throw error;
    }

    // Show platform URL form
    let html = FORM_HTML;
    const placeholders = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state'];
    placeholders.forEach(param => {
      html = html.replace(
        new RegExp(`{{${param}}}`, 'g'),
        (params[param] || '').toString()
      );
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: html
    };

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify(
        createOAuthError(
          OAuthErrorType.SERVER_ERROR,
          'Internal server error'
        )
      )
    };
  }
};

/**
 * Handle initial login request
 */
async function handleStartLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_request', error_description: 'Missing request body' })
      };
    }

    const params = JSON.parse(event.body) as {
      platform_url: string;
      client_id: string;
      redirect_uri: string;
      state?: string;
    };

    if (!params.platform_url || !params.client_id || !params.redirect_uri) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' })
      };
    }

    // Get initial token from IB
    const ibResponse = await ibClient.getInitialToken(params.platform_url);

    // Generate polling token and store state
    const pollToken = Math.random().toString(36).substring(2, 15);
    // Store original OAuth state with polling token
    await storageService.storeState(
      params.client_id,
      params.redirect_uri,
      'profile', // Default scope
      ibResponse,
      params.platform_url,
      pollToken, // Use as key
      params.state // Store original OAuth state
    );

    // Generate IB login URL with target=parent for iframe
    const loginUrl = `${params.platform_url}/auth/?login=0&token=${ibResponse.content}&target=parent`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        loginUrl,
        token: pollToken
      })
    };
  } catch (error) {
    console.error('Start login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to start login process'
      })
    };
  }
}

/**
 * Handle login status polling
 */
async function handlePollLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const { token } = params;

    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing token parameter'
        })
      };
    }

    // Get state entry using token as poll token
    const stateEntry = await storageService.getState(token);

    try {
      // Get session info
      // Initial token is a string
      const sessionInfo = await ibClient.getSessionInfo(stateEntry.platformUrl, stateEntry.ibToken.content as string);

      // Generate authorization code
      const code = Math.random().toString(36).substring(2, 15);

      // Store session info with code
      // Store code while preserving original OAuth state
      await storageService.storeState(
        stateEntry.clientId,
        stateEntry.redirectUri,
        stateEntry.scope,
        {
          sid: sessionInfo.content.session.sid,
          content: {
            apiV3url: sessionInfo.content.info.apiV3url,
            clientid: sessionInfo.content.info.clientid
          }
        },
        stateEntry.platformUrl,
        code,
        stateEntry.oauthState
      );

      // Delete polling state
      await storageService.deleteState(token);

      // Generate redirect URL
      // Generate redirect URL with original OAuth state
      const redirectUrl = generateAuthCodeRedirect(
        stateEntry.redirectUri,
        code,
        stateEntry.oauthState // Use original OAuth state from initial request
      );

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ redirect_url: redirectUrl })
      };

    } catch (error) {
      if (error instanceof Error && error.message === 'Authentication pending') {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'authorization_pending',
            error_description: 'The authorization request is still pending'
          })
        };
      }
      throw error;
    }

  } catch (error) {
    console.error('Poll login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to check login status'
      })
    };
  }
}