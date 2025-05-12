import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { storageService } from '../../services/storage';
import { StateEntry } from '../../services/storage/memory';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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

    // Get state entry using token from IB
    const states = await storageService.getAllStates();
    const stateEntry = Array.from(states.values()).find(
      (entry: StateEntry) => entry.ibToken.content === token
    );

    if (!stateEntry) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid token'
        })
      };
    }

    // Keep the original state entry but update the token
    await storageService.storeState(
      stateEntry.clientId,
      stateEntry.redirectUri,
      stateEntry.scope,
      {
        sid: token,
        content: token // Use callback token for session info
      },
      stateEntry.platformUrl,
      stateEntry.key, // Keep using original poll token as key
      stateEntry.oauthState // Keep original OAuth state
    );

    // Return success page with CORS headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Complete</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .message {
              text-align: center;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <div class="message">
            <h2>Login Complete</h2>
            <p>You can close this window and return to the application.</p>
          </div>
          <script>
            // Signal success to parent window
            window.parent.postMessage('login_complete', '*');
          </script>
        </body>
        </html>
      `
    };

  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'server_error', 
        error_description: 'Internal server error' 
      })
    };
  }
};