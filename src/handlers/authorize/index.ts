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
import {
  getWellKnownClient,
  validateRedirectUri
} from '../../config/well-known-clients';

// Embed HTML template directly to avoid filesystem access in Lambda
// Declare window augmentation for TypeScript
declare global {
    interface Window {
        pollInterval: NodeJS.Timeout;
        currentToken: string;
    }
}

const FORM_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IntelligenceBank OAuth</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            max-width: 480px;
            margin: 40px auto;
            padding: 20px;
            background: #f4f5f7;
            color: #172b4d;
        }
        .container {
            background: #fff;
            padding: 32px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
        h2 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #172b4d;
        }
        p {
            color: #6b778c;
            font-size: 15px;
            margin-bottom: 24px;
        }
        .form-group {
            margin-bottom: 24px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            font-size: 14px;
        }
        input[type="url"] {
            width: 100%;
            padding: 8px 12px;
            font-size: 15px;
            border: 2px solid #dfe1e6;
            border-radius: 4px;
            box-sizing: border-box;
            transition: all 0.2s ease;
        }
        input[type="url"]:focus {
            outline: none;
            border-color: #F68D32;
            box-shadow: 0 0 0 2px rgba(246, 141, 50, 0.2);
        }
        button {
            display: block;
            width: 100%;
            padding: 10px 16px;
            font-size: 15px;
            font-weight: 500;
            color: white;
            background: #F68D32;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        button:hover {
            background: #F68D32;
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .help-text {
            font-size: 13px;
            color: #6b778c;
            margin-top: 8px;
        }
        #login-container {
            display: none;
            margin-top: 20px;
        }
        #login-frame {
            width: 100%;
            height: 600px;
            border: 2px solid #dfe1e6;
            border-radius: 4px;
        }
        .status {
            margin: 16px 0;
            padding: 12px;
            border-radius: 4px;
            font-size: 14px;
            background: #f4f5f7;
        }
        .status.error {
            background: #ffebe6;
            color: #de350b;
        }
        .status.success {
            background: #e3fcef;
            color: #00875a;
        }
        .loader {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        .loader::after {
            content: '';
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 3px solid #dfe1e6;
            border-radius: 50%;
            border-top-color: #F68D32;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
            body {
                margin: 0;
            }
            .container {
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Connect to IntelligenceBank</h2>
            <p>Enter your IntelligenceBank platform URL to continue with the authentication process.</p>
        </div>
        
        <div id="url-form">
            <form id="platform-form">
                <input type="hidden" name="client_id" value="{{client_id}}">
                <input type="hidden" name="redirect_uri" value="{{redirect_uri}}">
                <input type="hidden" name="response_type" value="{{response_type}}">
                <input type="hidden" name="scope" value="{{scope}}">
                <input type="hidden" name="state" value="{{state}}">
                <input type="hidden" name="code_challenge" value="{{code_challenge}}">
                <input type="hidden" name="code_challenge_method" value="{{code_challenge_method}}">
                
                <div class="form-group">
                    <label for="platform_url">Platform URL:</label>
                    <input type="url"
                           id="platform_url"
                           name="platform_url"
                           value="{{platform_url}}"
                           placeholder="https://company.intelligencebank.com"
                           required
                    >
                    <div class="help-text">
                        Enter your IntelligenceBank URL (e.g., https://company.intelligencebank.com)
                    </div>
                </div>
                
                <button type="submit">Continue to Login</button>
            </form>
        </div>

        <div id="login-container">
            <div class="header">
                <h2>Complete Login</h2>
                <p>Please complete the login process in the popup window. If you don't see the window, check if it was blocked by your browser.</p>
            </div>
            <div class="loader" id="login-loader"></div>
            <div class="status" id="status-message">Waiting for login completion...</div>
        </div>
    </div>

    <script>
        // Debug logging helper
        function logDebug(action, data) {
            console.log("[OAuth Debug] " + action + ":", data);
        }

        // Listen for message from auth window
        window.addEventListener('message', (event) => {
            // Verify origin is from IntelligenceBank domain
            const platformUrl = sessionStorage.getItem('platform_url');
            if (platformUrl && event.origin === new URL(platformUrl).origin) {
                if (event.data === 'login_complete') {
                    logDebug('Received login complete message from:', event.origin);
                    showStatus('Login successful, checking status...', 'success');
                }
            } else {
                logDebug('Ignored message from untrusted origin:', event.origin);
            }
        });

        // Store platform URL for origin verification
        document.getElementById('platform-form').addEventListener('submit', function(e) {
            const platformUrl = e.target.querySelector('#platform_url').value;
            sessionStorage.setItem('platform_url', platformUrl);
        });

        // Handle form submission
        document.getElementById('platform-form').onsubmit = async function(e) {
            e.preventDefault();
            const submitButton = e.target.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Connecting...';
            
            const form = e.target;
            const formData = {};
            
            for (let input of form.elements) {
                if (input.name) {
                    formData[input.name] = input.value;
                }
            }
            
            try {
                // Build query string
                const queryString = new URLSearchParams(formData).toString();
                // Use relative URL to avoid issues with CloudFront
                // Include Accept header to indicate we expect JSON response
                const response = await fetch("?" + queryString, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const data = await response.json();
                logDebug('Auth response', data);
                
                if (response.ok && data.loginUrl) {
                    // Show login container
                    document.getElementById('url-form').style.display = 'none';
                    document.getElementById('login-container').style.display = 'block';
                    document.getElementById('login-loader').style.display = 'block';

                    // Open login URL in new window
                    window.open(data.loginUrl, 'ib_login', 'width=800,height=600');
                    // Start polling immediately
                    startPolling(data.token);
                } else {
                    showError(data.error_description || 'Failed to start login');
                    submitButton.disabled = false;
                    submitButton.textContent = 'Continue to Login';
                }
            } catch (error) {
                showError('Failed to initialize login');
                submitButton.disabled = false;
                submitButton.textContent = 'Continue to Login';
            }
        };

        // Poll for login completion
        function startPolling(token) {
            showStatus('Waiting for login completion...');
            document.getElementById('login-loader').style.display = 'block';
            
            // Store interval ID in window
            window.pollInterval = setInterval(async () => {
                try {
                    // Use full URL path for API Gateway
                    const response = await fetch(window.location.pathname + '/poll?token=' + token);
                    const data = await response.json();

                    if (response.status === 404) {
                        // Still pending, continue polling
                        return;
                    }
                    
                    // Stop polling for any response other than 404
                    clearInterval(window.pollInterval);
                    
                    if (response.ok && data.redirect_url) {
                        // Show success and redirect to callback
                        showStatus('Login successful! Redirecting...', 'success');
                        // Small delay to show success message
                        setTimeout(() => {
                            window.location.href = data.redirect_url;
                        }, 1000);
                    } else {
                        // Show error for non-success responses
                        showError(data.error_description || 'Login failed');
                    }
                } catch (error) {
                    showError('Failed to check login status');
                    clearInterval(window.pollInterval);
                }
            }, 1000); // Poll every second
        }

        function showStatus(message, type = 'info') {
            const status = document.getElementById('status-message');
            status.textContent = message;
            status.className = 'status' + (type !== 'info' ? ' ' + type : '');
            
            if (type === 'success' || type === 'error') {
                document.getElementById('login-loader').style.display = 'none';
            }
        }

        function showError(message) {
            showStatus(message, 'error');
            const submitButton = document.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Continue to Login';
            }
        }
    </script>
</body>
</html>`;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle polling endpoint - check for both /authorize/poll and /dev/authorize/poll or /main/authorize/poll
    if (event.path.endsWith('/authorize/poll')) {
      return handlePollLogin(event);
    }

    const params = event.queryStringParameters || {};

    // Determine if this is a form submission or initial authorization request
    // Form submissions will have Accept: application/json header (from fetch)
    // Initial OAuth requests will have Accept: text/html (from browser navigation)
    const acceptHeader = event.headers?.['Accept'] || event.headers?.['accept'] || '';
    const isFormSubmission = params.platform_url && acceptHeader.includes('application/json');

    if (isFormSubmission) {
      // This is a form submission - return JSON response to start login flow
      console.log('Handling form submission with platform_url:', params.platform_url);
      return handleStartLogin({
        ...event,
        body: JSON.stringify(params)
      });
    }

    // Otherwise show the authorization form (initial OAuth request or browser navigation)
    console.log('Showing authorization form, platform_url provided:', !!params.platform_url);

    // First validate base OAuth parameters
    try {
      BaseAuthorizeParamsSchema.parse(params);
    } catch (error) {
      console.log('Validation error:', error);
      console.log('Params:', params);
      if (error instanceof ZodError) {
        if (!params.redirect_uri) {
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
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

    // Validate well-known client
    // At this point, params have been validated by BaseAuthorizeParamsSchema
    const clientId = params.client_id!;
    const redirectUri = params.redirect_uri!;
    
    const client = getWellKnownClient(clientId);
    if (!client) {
      console.log('Unknown client_id:', clientId);
      return {
        statusCode: 302,
        headers: {
          Location: generateErrorRedirect(redirectUri, createOAuthError(
            OAuthErrorType.UNAUTHORIZED_CLIENT,
            `Unknown client_id. Use the documented client_id: "mcp-public-client"`,
            params.state
          ))
        },
        body: ''
      };
    }

    // Validate redirect URI against client's allowed patterns
    if (!validateRedirectUri(clientId, redirectUri)) {
      console.log('Invalid redirect_uri for client:', {
        client_id: clientId,
        redirect_uri: redirectUri
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify(
          createOAuthError(
            OAuthErrorType.INVALID_REQUEST,
            'redirect_uri does not match allowed patterns for this client'
          )
        )
      };
    }

    // Validate PKCE for public clients
    if (client.requires_pkce && !params.code_challenge) {
      console.log('PKCE required but not provided for public client');
      return {
        statusCode: 302,
        headers: {
          Location: generateErrorRedirect(redirectUri, createOAuthError(
            OAuthErrorType.INVALID_REQUEST,
            'code_challenge is required for public clients (PKCE)',
            params.state
          ))
        },
        body: ''
      };
    }

    // Validate PKCE method is S256
    if (params.code_challenge && params.code_challenge_method !== 'S256') {
      console.log('Invalid PKCE method:', params.code_challenge_method);
      return {
        statusCode: 302,
        headers: {
          Location: generateErrorRedirect(redirectUri, createOAuthError(
            OAuthErrorType.INVALID_REQUEST,
            'code_challenge_method must be S256',
            params.state
          ))
        },
        body: ''
      };
    }

    // Show platform URL form
    // Process template variables
    let html = FORM_HTML;
    
    // Replace template variables with actual values
    const templateVars: Record<string, string> = {
      client_id: params.client_id || '',
      redirect_uri: params.redirect_uri || '',
      response_type: params.response_type || '',
      scope: params.scope || '',
      state: params.state || '',
      code_challenge: params.code_challenge || '',
      code_challenge_method: params.code_challenge_method || '',
      platform_url: params.platform_url || '' // Pre-populate if provided
    };
    
    html = html.replace(/\{\{(.*?)\}\}/g, (match, p1) => {
      return templateVars[p1] !== undefined ? templateVars[p1] : '';
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src *;",
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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
interface StartLoginParams {
  platform_url: string;
  client_id: string;
  redirect_uri: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

async function handleStartLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get parameters from either query string or body
    let params: StartLoginParams;

    if (event.httpMethod === 'GET') {
      const queryParams = event.queryStringParameters || {};
      params = {
        platform_url: queryParams.platform_url || '',
        client_id: queryParams.client_id || '',
        redirect_uri: queryParams.redirect_uri || '',
        state: queryParams.state,
        code_challenge: queryParams.code_challenge,
        code_challenge_method: queryParams.code_challenge_method
      };
    } else {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          },
          body: JSON.stringify({ error: 'invalid_request', error_description: 'Missing request body' })
        };
      }
      params = JSON.parse(event.body);
    }

    // Validate required parameters
    if (!params.platform_url || !params.client_id || !params.redirect_uri) {
      console.log('Missing required parameters:', { params, event });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' })
      };
    }

    // Validate well-known client
    const client = getWellKnownClient(params.client_id);
    if (!client) {
      console.log('Unknown client_id in start login:', params.client_id);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
          error: 'unauthorized_client',
          error_description: 'Unknown client_id. Use the documented client_id: "mcp-public-client"'
        })
      };
    }

    // Validate redirect URI
    if (!validateRedirectUri(params.client_id, params.redirect_uri)) {
      console.log('Invalid redirect_uri in start login:', {
        client_id: params.client_id,
        redirect_uri: params.redirect_uri
      });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'redirect_uri does not match allowed patterns for this client'
        })
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
      params.state, // Store original OAuth state
      params.code_challenge,
      params.code_challenge_method
    );

    // Generate IB login URL for iframe
    const loginUrl = ibClient.generateLoginUrl(
      params.platform_url,
      ibResponse.content as string
    );

    console.log('Generated login URL:', loginUrl);

    // Return login URL and polling token for iframe
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
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
    console.log('Poll login request:', {
      path: event.path,
      method: event.httpMethod,
      params: event.queryStringParameters
    });
    
    const params = event.queryStringParameters || {};
    const { token } = params;

    // Common headers for all responses
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (!token) {
      console.log('Missing token in poll request');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing token parameter'
        })
      };
    }

    // Get state entry using token as poll token
    console.log('Retrieving state for token:', token);
    const stateEntry = await storageService.getState(token);
    console.log('State entry found:', {
      clientId: stateEntry.clientId,
      platformUrl: stateEntry.platformUrl,
      hasIbToken: !!stateEntry.ibToken
    });

    try {
      // Get session info
      console.log('Checking session info with IB');
      const sessionInfo = await ibClient.getSessionInfo(stateEntry.platformUrl, stateEntry.ibToken.content as string);
      console.log('Session info received:', {
        hasSid: !!sessionInfo.content.session.sid,
        hasApiUrl: !!sessionInfo.content.info.apiV3url
      });

      // Generate authorization code
      const code = Math.random().toString(36).substring(2, 15);
      // Generate redirect URL to client's callback URL
      const redirectUrl = generateAuthCodeRedirect(
        stateEntry.redirectUri, // Client's callback URL
        code,
        stateEntry.oauthState // Use original OAuth state from initial request
      );

      // Store session info with code for token exchange
      await storageService.storeState(
        stateEntry.clientId,
        stateEntry.redirectUri,
        stateEntry.scope,
        {
          sid: sessionInfo.content.session.sid,
          content: sessionInfo.content
        },
        stateEntry.platformUrl,
        code, // Use auth code as key for token exchange
        stateEntry.oauthState,
        stateEntry.codeChallenge,
        stateEntry.codeChallengeMethod
      );

      // Delete polling state last, after everything else is ready
      await storageService.deleteState(token);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ redirect_url: redirectUrl })
      };

    } catch (error) {
      if (error instanceof Error && error.message === 'Authentication pending') {
        return {
          statusCode: 404,
          headers,
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Failed to check login status'
      })
    };
  }
}