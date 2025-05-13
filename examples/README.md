# IntelligenceBank OAuth Examples

This directory contains example implementations and SDKs for integrating with the IntelligenceBank OAuth service.

## JavaScript SDK

The JavaScript SDK provides a client-side implementation suitable for both browser and Node.js environments.

### Installation
```bash
# Copy the SDK file to your project
cp javascript/ib-oauth-client.js your-project/

# Or use it directly in HTML
<script src="ib-oauth-client.js"></script>
```

### Usage
```javascript
const client = new IBOAuthClient({
  clientId: 'your-client-id',
  redirectUri: 'https://your-app.com/callback',
  baseUrl: 'https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev'
});

// Start OAuth flow
window.location.href = client.getAuthUrl();

// Handle callback
const code = new URLSearchParams(window.location.search).get('code');
const tokens = await client.handleCallback(code);

// Make API requests
const response = await client.request('company.intelligencebank.com/api/3.0.0/users');
```

## Python SDK

The Python SDK provides a Pythonic interface for server-side applications.

### Installation
```bash
# Copy the SDK files to your project
cp python/ib_oauth_client.py your-project/
```

### Usage
```python
from ib_oauth_client import IBOAuthClient, OAuthConfig

config = OAuthConfig(
    client_id="your-client-id",
    redirect_uri="https://your-app.com/callback"
)

client = IBOAuthClient(config)

# Start OAuth flow
auth_url = client.get_auth_url()

# Handle callback
tokens = client.handle_callback(code="auth_code")

# Make API requests
response = client.request("company.intelligencebank.com/api/3.0.0/users")
```

## Express.js Integration Example

A complete example showing how to integrate the OAuth flow in an Express.js application.

### Setup
```bash
cd integrations/express-app
npm install
```

### Configuration
Set the following environment variables or update them in app.js:
```bash
export IB_CLIENT_ID=your-client-id
export IB_REDIRECT_URI=http://localhost:3000/callback
export IB_BASE_URL=https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev
```

### Running the Example
```bash
npm start
# Open http://localhost:3000 in your browser
```

## Features Demonstrated

1. **OAuth Flow**
   - Authorization request
   - Platform URL handling
   - Code exchange
   - Token management

2. **Session Management**
   - Token storage
   - Session expiry handling
   - Automatic token refresh
   - Logout functionality

3. **Error Handling**
   - Invalid tokens
   - Expired sessions
   - API errors
   - Network issues

4. **Security Best Practices**
   - CSRF protection
   - Secure token storage
   - Session validation
   - Error handling

## Common Issues

1. **CORS Errors**
   - Ensure your redirect URI is allowed
   - Check platform URL format
   - Verify API endpoint configuration

2. **Token Errors**
   - Check token expiration
   - Verify session state
   - Confirm refresh token validity

3. **Session Issues**
   - Monitor session timeout
   - Check refresh attempts
   - Validate session age

## Additional Resources

- [Main Documentation](../README.md)
- [API Documentation](../cline_docs/api-documentation.md)
- [Error Codes](../cline_docs/api-documentation.md#error-codes)
- [Best Practices](../cline_docs/api-documentation.md#best-practices)

## Support

For issues or questions:
1. Check the documentation
2. Open an issue in the repository
3. Contact IntelligenceBank support