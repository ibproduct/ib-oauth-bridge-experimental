# Client Integration Guide

## Overview
This guide explains how to integrate with the OAuth service and use the IB API proxy endpoint. The service provides a standard OAuth 2.0 flow for authentication and a simple proxy endpoint for making IB API calls.

## Authentication Flow

### 1. OAuth Authorization
```typescript
// Redirect user to authorization endpoint
const authUrl = `https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/authorize
  ?response_type=code
  &client_id=${clientId}
  &redirect_uri=${redirectUri}
  &scope=profile
  &state=${state}`;

window.location.href = authUrl;
```

### 2. Handle Callback
```typescript
// On redirect back to your application
async function handleCallback(code: string) {
  const response = await fetch('https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });

  const tokens = await response.json();
  // Store tokens.access_token for API calls
}
```

## Making API Calls

### API Client Setup
```typescript
// Initialize API client with OAuth token
const apiClient = axios.create({
  baseURL: 'https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy',
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});
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
        // Token expired - refresh token or re-authenticate
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

## Token Refresh

### Refresh Flow
```typescript
async function refreshToken(refresh_token: string) {
  const response = await fetch('https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token
    })
  });

  const tokens = await response.json();
  // Update stored tokens
  return tokens.access_token;
}
```

### Automatic Refresh Example
```typescript
// Create axios instance with refresh interceptor
const apiClient = axios.create({
  baseURL: 'https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy'
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired
      const newToken = await refreshToken(refresh_token);
      error.config.headers['Authorization'] = `Bearer ${newToken}`;
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

## Best Practices

### Security
1. Store tokens securely
2. Use HTTPS for all requests
3. Implement proper error handling
4. Follow OAuth 2.0 security guidelines

### Performance
1. Reuse API client instance
2. Implement request timeout
3. Add retry logic for failures
4. Cache responses when appropriate

### Error Handling
1. Handle all error cases
2. Implement token refresh
3. Add request retry logic
4. Log errors appropriately

## Example Implementation

### Complete Client Example
```typescript
class IBAPIClient {
  private apiClient: AxiosInstance;
  private refreshToken: string;

  constructor(accessToken: string, refreshToken: string) {
    this.refreshToken = refreshToken;
    this.apiClient = axios.create({
      baseURL: 'https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev/proxy',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    // Add refresh interceptor
    this.apiClient.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          const newToken = await this.handleTokenRefresh();
          error.config.headers['Authorization'] = `Bearer ${newToken}`;
          return this.apiClient.request(error.config);
        }
        return Promise.reject(error);
      }
    );
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
1. Token expired
   - Implement token refresh
   - Check token expiration
   - Verify refresh token

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