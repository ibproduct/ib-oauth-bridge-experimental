import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { ibClient } from '../../services/ib-client';
import { storageService } from '../../services/storage';
import { 
  validateAuthorizeParams, 
  createOAuthError, 
  generateErrorRedirect,
  OAuthErrorType
} from '../../utils/oauth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Extract and validate query parameters
    const params = event.queryStringParameters || {};
    const validatedParams = validateAuthorizeParams(params);
    const { client_id, redirect_uri, scope, state: providedState } = validatedParams;

    try {
      // Get initial token from IB
      const { content: ibToken } = await ibClient.getInitialToken();

      // Store state and associated data
      const state = await storageService.storeState(
        client_id,
        redirect_uri,
        scope,
        ibToken
      );

      // Generate IB login URL with stored state
      const loginUrl = ibClient.generateLoginUrl(ibToken, redirect_uri, state);

      // Redirect to IB login page
      return {
        statusCode: 302,
        headers: {
          Location: loginUrl
        },
        body: ''
      };
    } catch (error) {
      // Handle IB API or storage errors
      console.error('Authorization error:', error);
      
      const oauthError = createOAuthError(
        OAuthErrorType.SERVER_ERROR,
        'Failed to process authorization request',
        providedState
      );

      return {
        statusCode: 302,
        headers: {
          Location: generateErrorRedirect(redirect_uri, oauthError)
        },
        body: ''
      };
    }
  } catch (error) {
    // Handle validation errors
    if (error instanceof ZodError) {
      // If we can't validate redirect_uri, we can't redirect
      if (!event.queryStringParameters?.redirect_uri) {
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

      const redirectUri = event.queryStringParameters.redirect_uri;
      const state = event.queryStringParameters.state;

      const oauthError = createOAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Invalid request parameters',
        state
      );

      return {
        statusCode: 302,
        headers: {
          Location: generateErrorRedirect(redirectUri, oauthError)
        },
        body: ''
      };
    }

    // Handle unexpected errors
    console.error('Unexpected error:', error);
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