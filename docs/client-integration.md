# Client Integration Guide

## Overview

This guide explains how to integrate with the OAuth service and use the IB API proxy endpoint. The service provides a standard OAuth 2.0 flow for authentication and a simple proxy endpoint for making IB API calls.

## Service Endpoints

### Development Environment
**Base URL**: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/`
- Uses latest code ($LATEST via `dev` alias)
- Auto-updates on deployment
- For testing and development

### Production Environment
**Base URL**: `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/main/`
- Uses published versions via `main` alias
- Manually promoted from dev
- Stable production code

> **Note:** The service uses a single-stack architecture with Lambda aliases. See [development-workflow.md](./development-workflow.md) for details on the deployment process.

## Authentication Flow

### 1. OAuth Authorization
```typescript
// Generate PKCE parameters
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

// Redirect user to authorization endpoint
async function startAuth() {
  const { codeVerifier, codeChallenge } = await generatePKCE();
  
  // Store code verifier for token exchange
  sessionStorage.setItem('code_verifier', codeVerifier);
  
  const authUrl = `https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/authorize
    ?response_type=code
    &client_id=${clientId}
    &redirect_uri=${redirectUri}
    &scope=profile
    &state=${state}
    &code_challenge=${codeChallenge}
    &code_challenge_method=S256`;

  window.location.href = authUrl;
}
```

### 2. Handle Callback
```typescript
// On redirect back to your application
async function handleCallback(code: string) {
  const response = await fetch('https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: sessionStorage.getItem('code_verifier')
    })
  });

  const tokens = await response.json();
  // Store tokens.access_token for API calls
}
```

## Getting User Information

### Fetch User Profile
```typescript
// Get user information using access token
async function getUserInfo() {
  const response = await fetch('https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/userinfo', {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.error === 'invalid_token') {
      // Handle token errors (see Error Handling section)
      return;
    }
    throw new Error('Failed to fetch user info');
  }

  const userInfo = await response.json();
  // userInfo contains:
  // - sub: User's unique identifier
  // - name: Full name
  // - given_name: First name
  // - family_name: Last name
  // - email: Optional email address
  // - updated_at: Last update timestamp
  // - ib_client_id: IB client ID
  // - ib_api_url: IB API URL
  // - ib_user_uuid: Same as sub
  // - ib_session_id: IB session ID
  return userInfo;
}
```

Note: The userinfo endpoint returns user profile information that was obtained during the authentication flow. No additional API calls to IntelligenceBank are made.

## Making API Calls

### API Client Setup
```typescript
// Initialize API client with OAuth token
const apiClient = axios.create({
  baseURL: 'https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/proxy',
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

// Add refresh interceptor for session management
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const errorData = error.response.data;
      
      if (errorData.error === 'invalid_token') {
        if (errorData.error_description === 'Session has expired' ||
            errorData.error_description === 'Session refresh limit exceeded') {
          // Session expired - need to re-authenticate
          clearTokens();
          redirectToAuth();
          return;
        }
        
        // Try token refresh
        try {
          const newTokens = await refreshTokens(refresh_token);
          error.config.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
          return apiClient.request(error.config);
        } catch (refreshError) {
          // Refresh failed - need to re-authenticate
          clearTokens();
          redirectToAuth();
          return;
        }
      }
    }
    throw error;
  }
);
```

### Making Requests
```typescript
// Example API calls
try {
  // Get users
  const users = await apiClient.get(
    '/company.intelligencebank.com/api/3.0.0/12345/users'
  );

  // Create asset
  const asset = await apiClient.post(
    '/company.intelligencebank.com/api/3.0.0/12345/assets',
    assetData
  );

  // Update category
  const category = await apiClient.put(
    '/company.intelligencebank.com/api/3.0.0/12345/categories/67890',
    categoryData
  );

  // Delete folder
  await apiClient.delete(
    '/company.intelligencebank.com/api/3.0.0/12345/folders/11111'
  );

} catch (error) {
  // Handle errors (see Error Handling section)
}
```

Note: Do not include 'https://' in the proxy paths - it is automatically added by the server.

## Session Management

### Session Lifecycle

1. Initial Authentication
   - User completes OAuth flow
   - Server provides access token and session info
   - Session timeout period (logintimeoutperiod) is 1-120 hours

2. Active Session
   - Use access token for API calls
   - Server tracks session expiry
   - Server manages refresh attempts

3. Session Refresh
   - Server automatically refreshes when needed
   - Tracks number of refresh attempts
   - Enforces maximum refresh limit

4. Session Expiry
   - Occurs when:
     * Session timeout period exceeded
     * Maximum refresh attempts reached
   - Client must re-authenticate user

### Handling Session Expiry

When a session expires, the server returns:
```json
{
  "error": "invalid_token",
  "error_description": "Session has expired"
}
```
or
```json
{
  "error": "invalid_token",
  "error_description": "Session refresh limit exceeded"
}
```

Client should:
1. Clear stored tokens
2. Redirect to authorization endpoint
3. Begin new OAuth flow

Example Implementation:
```typescript
function handleSessionExpiry() {
  // Clear stored tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');

  // Save current state if needed
  localStorage.setItem('pre_auth_path', window.location.pathname);

  // Redirect to authorization
  window.location.href = getAuthUrl();
}

// Usage in API client
if (error.response?.status === 401) {
  const errorData = error.response.data;
  if (errorData.error === 'invalid_token' && 
      (errorData.error_description === 'Session has expired' ||
       errorData.error_description === 'Session refresh limit exceeded')) {
    handleSessionExpiry();
    return;
  }
}
```

## Error Handling

### OAuth Errors
```typescript
{
  error: 'invalid_token',
  error_description: 'The access token has expired'
}

{
  error: 'invalid_request',
  error_description: 'Missing or invalid parameters'
}
```

### HTTP Status Codes
- 401: Authentication failed (token expired/invalid)
- 403: Insufficient permissions
- 429: Rate limit exceeded
- 500: Server error

### Error Handling Example
```typescript
try {
  const response = await apiClient.get('/company.intelligencebank.com/api/3.0.0/12345/users');
} catch (error) {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        // Check for session expiry
        if (error.response.data.error === 'invalid_token') {
          if (error.response.data.error_description === 'Session has expired' ||
              error.response.data.error_description === 'Session refresh limit exceeded') {
            handleSessionExpiry();
            return;
          }
        }
        // Other token errors - try refresh
        break;
      case 403:
        // Insufficient permissions
        break;
      case 429:
        // Rate limit exceeded - implement backoff
        break;
      default:
        // Handle other errors
    }
  }
}
```

## Best Practices

### Security
1. Store tokens securely
2. Use HTTPS for all requests
3. Implement proper error handling
4. Follow OAuth 2.0 security guidelines
5. Clear tokens on session expiry
6. Implement PKCE for enhanced security:
   - Generate secure code verifier
   - Use SHA-256 for code challenge
   - Store code verifier securely
   - Include in token exchange

### Performance
1. Reuse API client instance
2. Implement request timeout
3. Add retry logic for failures
4. Cache responses when appropriate

### Error Handling
1. Handle all error cases
2. Implement token refresh
3. Handle session expiry
4. Add request retry logic
5. Log errors appropriately

### Session Management
1. Track session state
2. Handle expiry gracefully
3. Preserve user context
4. Implement smooth re-auth
5. Clear invalid sessions

## Example Implementation

### Complete Client Example
```typescript
class IBAPIClient {
  private apiClient: AxiosInstance;
  private refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.refreshToken = refreshToken;
    this.apiClient = axios.create({
      baseURL: 'https://66qz7xd2w8.execute-api.us-west-1.amazonaws.com/dev/proxy',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Add refresh interceptor
    this.apiClient.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          const errorData = error.response.data;
          
          if (errorData.error === 'invalid_token') {
            if (errorData.error_description === 'Session has expired' ||
                errorData.error_description === 'Session refresh limit exceeded') {
              this.handleSessionExpiry();
              return;
            }
            
            const newToken = await this.handleTokenRefresh();
            error.config.headers['Authorization'] = `Bearer ${newToken}`;
            return this.apiClient.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private handleSessionExpiry() {
    // Clear tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    // Save state
    localStorage.setItem('pre_auth_path', window.location.pathname);

    // Redirect to auth
    window.location.href = this.getAuthUrl();
  }

  private async handleTokenRefresh() {
    const tokens = await this.refreshAccessToken(this.refreshToken);
    this.refreshToken = tokens.refresh_token;
    return tokens.access_token;
  }

  // API methods
  async getUsers() {
    return this.apiClient.get('/company.intelligencebank.com/api/3.0.0/12345/users');
  }

  async createAsset(data: any) {
    return this.apiClient.post('/company.intelligencebank.com/api/3.0.0/12345/assets', data);
  }

  async updateCategory(categoryId: string, data: any) {
    return this.apiClient.put(
      `/company.intelligencebank.com/api/3.0.0/12345/categories/${categoryId}`,
      data
    );
  }
}

// Usage
const client = new IBAPIClient(access_token, refresh_token);
const users = await client.getUsers();
```

## Troubleshooting

### Common Issues
1. Session expiry
   - Check error responses
   - Verify token refresh
   - Handle re-auth flow

2. Rate limiting
   - Implement backoff
   - Check rate limits
   - Add request queuing

3. Network errors
   - Add retry logic
   - Implement timeouts
   - Handle connection errors

### Support
For issues or questions:
1. Check error response details
2. Review documentation
3. Contact support team