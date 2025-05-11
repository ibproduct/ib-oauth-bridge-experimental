# IntelligenceBank OAuth 2.0 Bridge

This service provides OAuth 2.0 compatibility for IntelligenceBank's Browser Login API, allowing applications to integrate with IntelligenceBank using standard OAuth 2.0 flows.

## Overview

IntelligenceBank is a SaaS platform where each client has their own platform URL. This OAuth bridge service supports dynamic platform URLs, allowing clients to authenticate users against their specific IntelligenceBank instance.

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
   Content-Type: application/json

   {
     "grant_type": "authorization_code",
     "code": "authorization_code_from_callback",
     "redirect_uri": "same_as_authorize_request",
     "client_id": "your_client_id"
   }
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

5. **Access Protected Resources**
   ```
   GET /userinfo
   Authorization: Bearer {access_token}
   ```

   Response:
   ```json
   {
     "sub": "user_id",
     "name": "User Name",
     "email": "user@example.com",
     "email_verified": true
   }
   ```

## Implementation Guide

### 1. Platform URL Handling

The platform URL can be provided in two ways:

a) **Client-Provided URL**
   - Include `platform_url` parameter in the authorization request
   - Bridge service validates and uses this URL for authentication

b) **User-Provided URL**
   - Omit `platform_url` parameter
   - Bridge service will present a form for users to enter their platform URL
   - After URL validation, proceeds with authentication

### 2. Authentication Polling

After redirecting to the IntelligenceBank login page, your application should poll the authentication status:

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

### 3. Token Management

1. Store tokens securely
2. Use access token for API requests
3. Implement token refresh when access token expires:

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

The service follows OAuth 2.0 error response formats:

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

3. Resource Endpoint Errors
   ```
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Bearer error="invalid_token"
   ```

## Security Considerations

1. Always use HTTPS for all endpoints
2. Validate platform URLs against allowed domains
3. Implement state parameter for CSRF protection
4. Store tokens securely (e.g., encrypted at rest)
5. Implement token rotation for refresh tokens
6. Set appropriate token expiration times

## Rate Limiting

- Authorization endpoint: 10 requests per minute per IP
- Token endpoint: 20 requests per minute per client
- UserInfo endpoint: 30 requests per minute per token

## Support

For integration support or issues:
1. Check the [API Documentation](cline_docs/api-documentation.md)
2. Open an issue in this repository
3. Contact IntelligenceBank support

## License

[License information here]