# IntelligenceBank OAuth 2.0 Bridge

This service provides OAuth 2.0 compatibility for IntelligenceBank's Browser Login API, allowing applications to integrate with IntelligenceBank using standard OAuth 2.0 flows.

## Quick Start

1. **Initialize OAuth Flow**
   ```javascript
   const authUrl = 'https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize?' +
     new URLSearchParams({
       response_type: 'code',
       client_id: 'your_client_id',
       redirect_uri: 'https://your-app.com/callback',
       scope: 'profile',
       state: 'random_state_123',
       // PKCE parameters
       code_challenge: code_challenge,
       code_challenge_method: 'S256'
     });
   window.location.href = authUrl;
   ```

2. **Handle Callback**
   ```javascript
   // In your callback route
   const code = new URLSearchParams(window.location.search).get('code');
   const tokens = await exchangeCode(code);
   ```

3. **Make API Requests**
    ```javascript
    // List Users
    const response = await fetch('https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/user.limit(100).order(lastUpdateTime:-1)', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    // List Resources
    const resources = await fetch('https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/resource.limit(100).order(createTime:-1)', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    // Create Resource
    const createResource = await fetch('https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/resource', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          folder: "folder_id",
          type: "file",
          name: "My Resource",
          description: "Resource description",
          file: {
            // File details from upload response
          }
        }
      })
    });
    ```

## Overview

IntelligenceBank is a SaaS platform where each client has their own platform URL. This OAuth bridge service supports dynamic platform URLs, allowing clients to authenticate users against their specific IntelligenceBank instance.

The service implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) support, providing enhanced security for public clients. PKCE prevents authorization code interception attacks and is recommended for all integrations, especially mobile and single-page applications.

## Authentication Flow

1. **Initialize Authorization**
   ```
   GET /authorize
   ```
   
   Query Parameters:
   - `response_type`: Must be "code"
   - `client_id`: Your OAuth client ID
   - `redirect_uri`: Your callback URL
   - `scope`: Requested permissions
   - `platform_url`: Your IntelligenceBank platform URL (e.g., "https://company.intelligencebank.com")
   - `state`: (Optional) Client state for CSRF protection

2. **User Authentication**
   - User is redirected to their IntelligenceBank login page
   - User completes authentication on IntelligenceBank
   - Bridge service polls for authentication completion

3. **Handle Callback**
   - After successful login, user is redirected to your `redirect_uri`
   - Authorization code is provided in query parameters
   ```
   GET {redirect_uri}?code={authorization_code}&state={state}
   ```

4. **Exchange Code for Tokens**
    ```
    POST /token
    Content-Type: application/x-www-form-urlencoded

    grant_type=authorization_code
    &code=authorization_code_from_callback
    &redirect_uri=same_as_authorize_request
    &client_id=your_client_id
    &code_verifier=stored_code_verifier  // Required if PKCE was used
    ```

   Response:
   ```json
   {
     "access_token": "JWT_access_token",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "refresh_token_for_renewal"
   }
   ```

5. **Access IntelligenceBank API**
    ```
    GET /proxy/{ib-api-path}
    Authorization: Bearer {access_token}
    ```

    Examples:
    ```bash
    # List Users
    GET https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/user.limit(100).order(lastUpdateTime:-1)
    Authorization: Bearer {access_token}

    # List Resources
    GET https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/resource.limit(100).order(createTime:-1)
    Authorization: Bearer {access_token}

    # Create Resource
    POST https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/company.intelligencebank.com/api/3.0.0/clientid/resource
    Authorization: Bearer {access_token}
    Content-Type: application/json

    {
      "data": {
        "folder": "folder_id",
        "type": "file",
        "name": "My Resource",
        "description": "Resource description",
        "file": {
          // File details from upload response
        }
      }
    }
    ```

    Notes:
    - The complete proxy URL structure is: https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy/{platform-domain}/{api-path}
    - Do not include 'https://' in the {platform-domain} portion - it is automatically added
    - All HTTP methods are supported (GET, POST, PUT, PATCH, DELETE)
    - Request/response bodies are passed through unchanged
    - Headers are forwarded (except Authorization which is handled by the proxy)

6. **Access User Info**
    ```
    GET /userinfo
    Authorization: Bearer {access_token}
    ```

    Response:
    ```json
    {
      // Standard OpenID Connect claims
      "sub": "user_uuid",            // User's unique identifier
      "name": "John Doe",           // Full name
      "given_name": "John",         // First name
      "family_name": "Doe",         // Last name
      "email": "john@example.com",  // Email (optional)
      "updated_at": 1683936000,     // Last update timestamp

      // IntelligenceBank-specific claims
      "ib_client_id": "client123",  // IB client ID
      "ib_api_url": "https://company.intelligencebank.com/api/v3",
      "ib_user_uuid": "user123",    // Same as sub
      "ib_session_id": "session123" // IB session ID
    }
    ```

    Notes:
    - All user information comes from the successful authentication response
    - No additional API calls are made to fetch user data
    - The `email` field is optional and may not be present for all users
    - The `sub` claim uses the user's UUID as a unique identifier
    - The `updated_at` timestamp is from the original login time

## Implementation Guide

### 1. PKCE Implementation (Recommended)

PKCE (Proof Key for Code Exchange) is recommended for all clients, especially mobile apps and single-page applications:

1. **Generate PKCE Parameters**
   ```javascript
   async function generatePKCE() {
     const buffer = new Uint8Array(32);
     crypto.getRandomValues(buffer);
     const codeVerifier = btoa(String.fromCharCode(...buffer))
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=/g, '');

     const encoder = new TextEncoder();
     const data = encoder.encode(codeVerifier);
     const hash = await crypto.subtle.digest('SHA-256', data);
     const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=/g, '');

     return { codeVerifier, codeChallenge };
   }
   ```

2. **Use in Authorization Flow**
   ```javascript
   // Generate and store PKCE parameters
   const { codeVerifier, codeChallenge } = await generatePKCE();
   sessionStorage.setItem('code_verifier', codeVerifier);

   // Add to authorization request
   const params = new URLSearchParams({
     // ... other parameters ...
     code_challenge: codeChallenge,
     code_challenge_method: 'S256'
   });
   ```

3. **Include in Token Exchange**
   ```javascript
   const response = await fetch('/token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded'
     },
     body: new URLSearchParams({
       // ... other parameters ...
       code_verifier: sessionStorage.getItem('code_verifier')
     })
   });
   ```

### 2. Platform URL Handling

The platform URL can be provided in two ways:

a) **Client-Provided URL**
   - Include `platform_url` parameter in the authorization request
   - Bridge service validates and uses this URL for authentication

b) **User-Provided URL**
   - Omit `platform_url` parameter
   - Bridge service will present a form for users to enter their platform URL
   - After URL validation, proceeds with authentication

### 2. Authentication Polling

Note: The polling mechanism is a temporary solution until IntelligenceBank implements standard OAuth redirects. Once implemented, this step will be replaced with the standard OAuth redirect flow, simplifying the integration process.

Currently, after redirecting to the IntelligenceBank login page, your application needs to poll the authentication status:

```javascript
async function pollAuthStatus(authCode) {
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  let attempts = 0;

  const poll = async () => {
    try {
      const response = await fetch(`/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'your_redirect_uri',
          client_id: 'your_client_id'
        })
      });

      if (response.status === 200) {
        // Authentication successful
        const tokens = await response.json();
        return tokens;
      }

      if (response.status === 404) {
        // Authentication pending
        if (attempts++ < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          return poll();
        }
        throw new Error('Authentication timeout');
      }

      throw new Error('Authentication failed');
    } catch (error) {
      throw error;
    }
  };

  return poll();
}
```

### 3. Token and Session Management

1. **Token Storage**
   - Store tokens securely (e.g., encrypted in localStorage or secure cookie)
   - Never expose tokens in URLs or logs
   - Clear tokens on logout/session expiry

2. **Session Lifecycle**
   - Each session has a `logintimeoutperiod` (1-120 hours)
   - Server tracks session expiry and refresh attempts
   - 5-minute refresh window before expiry
   - Maximum refresh attempts configurable
   - Re-authentication required after session expiry

3. **Best Practices**
   - Implement automatic token refresh
   - Handle session expiry gracefully
   - Store session metadata (sidExpiry, sidCreatedAt)
   - Monitor refresh counts
   - Clear session on errors

4. **Token Refresh Implementation**:

```javascript
async function refreshTokens(refreshToken) {
  const response = await fetch('/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'your_client_id'
    })
  });

  if (response.ok) {
    return response.json();
  }
  throw new Error('Token refresh failed');
}
```

## Error Handling

The service follows OAuth 2.0 error response formats. Here's how to handle common scenarios:

### 1. Token Expiry
```javascript
async function handleApiRequest(url, token) {
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401) {
      const error = await response.json();
      if (error.error === 'invalid_token') {
        // Try token refresh
        const newTokens = await refreshTokens(refreshToken);
        // Retry request with new token
        return handleApiRequest(url, newTokens.access_token);
      }
    }
    
    return response.json();
  } catch (error) {
    handleError(error);
  }
}
```

### 2. Session Expiry
```javascript
function handleSessionExpiry(error) {
  if (error.error === 'invalid_token' &&
      error.error_description.includes('Session has expired')) {
    // Clear tokens
    clearStoredTokens();
    // Redirect to login
    window.location.href = getAuthUrl();
  }
}
```

### 3. Error Response Formats

1. Authorization Errors
   - Redirects to `redirect_uri` with error parameters
   ```
   ?error=invalid_request&error_description=Invalid parameters&state={state}
   ```

2. Token Endpoint Errors
   ```json
   {
     "error": "invalid_grant",
     "error_description": "Authorization code expired"
   }
   ```

3. Session Errors
   ```json
   {
     "error": "invalid_token",
     "error_description": "Session refresh limit exceeded"
   }
   ```
   ```json
   {
     "error": "invalid_token",
     "error_description": "Session has expired"
   }
   ```

4. Resource Endpoint Errors
   ```
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Bearer error="invalid_token"
   ```

### Session Expiry Handling

When a session expires (due to timeout or maximum refresh attempts):

1. Server returns `invalid_token` error with appropriate description
2. Client should:
   - Clear stored tokens
   - Redirect user to authorization endpoint
   - Begin new OAuth flow
3. Do not attempt to refresh tokens for expired sessions

This follows OAuth 2.0 best practices where the client is responsible for:
- Detecting expired sessions via error responses
- Initiating re-authentication when needed
- Managing the user experience during re-authentication

## Security Considerations

1. Always use HTTPS for all endpoints
2. Validate platform URLs against allowed domains
3. Implement state parameter for CSRF protection
4. Store tokens securely (e.g., encrypted at rest)
5. Implement token rotation for refresh tokens
6. Set appropriate token expiration times
7. Use PKCE for enhanced security:
   ```javascript
   // Generate PKCE parameters
   async function generatePKCE() {
     // Generate code verifier
     const buffer = new Uint8Array(32);
     crypto.getRandomValues(buffer);
     const codeVerifier = btoa(String.fromCharCode(...buffer))
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=/g, '');

     // Generate code challenge
     const encoder = new TextEncoder();
     const data = encoder.encode(codeVerifier);
     const hash = await crypto.subtle.digest('SHA-256', data);
     const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
       .replace(/\+/g, '-')
       .replace(/\//g, '_')
       .replace(/=/g, '');

     return { codeVerifier, codeChallenge };
   }

   // Use in authorization flow
   const { codeVerifier, codeChallenge } = await generatePKCE();
   // Store code_verifier for token exchange
   sessionStorage.setItem('code_verifier', codeVerifier);
   // Add code_challenge to authorization request
   ```

   Token Exchange with PKCE:
   ```javascript
   const code = new URLSearchParams(window.location.search).get('code');
   const codeVerifier = sessionStorage.getItem('code_verifier');
   
   const response = await fetch('/token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded'
     },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       code: code,
       redirect_uri: 'your_redirect_uri',
       client_id: 'your_client_id',
       code_verifier: codeVerifier
     })
   });
   ```

Note: The current polling-based authentication flow is secure but will be enhanced when IntelligenceBank implements standard OAuth redirects. This will provide a more streamlined and standardized security model.

## Rate Limiting

- Authorization endpoint: 10 requests per minute per IP
- Token endpoint: 20 requests per minute per client
- UserInfo endpoint: 30 requests per minute per token
- Proxy endpoints: 100 requests per minute per token
- Refresh endpoint: 30 requests per minute per client

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

## Support

For integration support or issues:

1. **Documentation**
   - [API Documentation](docs/api-documentation.md)
   - [Error Codes](docs/api-documentation.md#error-codes)
   - [Best Practices](docs/api-documentation.md#best-practices)

2. **Sample Code**
    - [Python Client](examples/python/ib_oauth_client.py) - Complete Python SDK with PKCE support, token management, and error handling

3. **Support Channels**
   - Open an issue in this repository
   - Contact IntelligenceBank support
