# API Documentation

## Base URL
`https://n4h948fv4c.execute-api.us-west-1.amazonaws.com/dev`

## Authorization Endpoints

### 1. Start Authorization
```http
GET /authorize
```

#### Query Parameters
- `response_type` (required): Must be "code"
- `client_id` (required): OAuth client ID
- `redirect_uri` (required): Client's callback URL
- `scope` (required): OAuth scope (e.g., "profile")
- `state` (recommended): Random state for CSRF protection
- `code_challenge` (recommended): PKCE code challenge
- `code_challenge_method` (recommended): PKCE challenge method (must be "S256")

#### Success Response
```html
<!-- Returns HTML form for platform URL input -->
<!DOCTYPE html>
<html>
  <!-- Platform URL form -->
</html>
```

#### Error Response
```json
{
  "error": "invalid_request",
  "error_description": "Invalid request parameters"
}
```

### 2. Submit Platform URL
```http
GET /authorize
```

#### Query Parameters
All parameters from initial request, plus:
- `platform_url` (required): IntelligenceBank platform URL

#### Success Response
```json
{
  "loginUrl": "https://company.intelligencebank.com/auth/?login=0&token=xyz",
  "token": "polling_token_123"
}
```

#### Error Response
```json
{
  "error": "invalid_request",
  "error_description": "Invalid platform URL"
}
```

### 3. Poll Login Status
```http
GET /authorize/poll
```

#### Query Parameters
- `token` (required): Polling token from platform URL submission

#### Success Response (Pending)
```json
{
  "error": "authorization_pending",
  "error_description": "The authorization request is still pending"
}
```

#### Success Response (Complete)
```json
{
  "redirect_url": "https://client.example.com/callback?code=xyz&state=abc"
}
```

#### Error Response
```json
{
  "error": "server_error",
  "error_description": "Failed to check login status"
}
```

## Token Endpoint

### 1. Exchange Authorization Code
```http
POST /token
Content-Type: application/x-www-form-urlencoded
```

#### Request Body
- `grant_type` (required): Must be "authorization_code"
- `code` (required): Authorization code from callback
- `redirect_uri` (required): Must match authorization request
- `code_verifier` (required if PKCE used): PKCE code verifier matching the code challenge

#### Success Response
```json
{
  "access_token": "access_token_xyz",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_xyz",
  "apiV3url": "https://company.intelligencebank.com/api/v3",
  "clientid": "ib_client_id",
  "sid": "ib_session_id",
  "logintimeoutperiod": 24,  // Session validity in hours (1-120)
  "sidExpiry": 1747234779,   // Unix timestamp when session expires
  "sidCreatedAt": 1747148379 // Unix timestamp when session was created
}
```

#### Error Response
```json
{
  "error": "invalid_request",
  "error_description": "Invalid authorization code"
}
```

### 2. Refresh Token
```http
POST /token
Content-Type: application/x-www-form-urlencoded
```

#### Request Body
- `grant_type` (required): Must be "refresh_token"
- `refresh_token` (required): Refresh token from previous token response
- `client_id` (required): OAuth client ID

#### Success Response
```json
{
  "access_token": "new_access_token_xyz",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_refresh_token_xyz",
  "sid": "ib_session_id",
  "sidExpiry": 1747234779,
  "sidCreatedAt": 1747148379
}
```

#### Error Response
```json
{
  "error": "invalid_grant",
  "error_description": "Invalid refresh token"
}
```

## Userinfo Endpoint

### Get User Information
```http
GET /userinfo
Authorization: Bearer <access_token>
```

#### Headers
- `Authorization` (required): Bearer token from token endpoint

#### Success Response
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

#### Error Response
```json
{
  "error": "invalid_token",
  "error_description": "Access token is invalid or has expired"
}
```

## Testing
1. Use the test client at `/api-test-client.html`
2. Click "Login with IntelligenceBank" to authenticate
3. After successful authentication, click "Test Userinfo" to verify the endpoint
4. The response will show all available user information

## Proxy Endpoint

### Forward Request to IB API
```http
ANY /proxy/{proxy+}
Authorization: Bearer <access_token>
```

#### Path Parameters
- `proxy+` (required): Full IB API path including domain and endpoint
  Example: `company.intelligencebank.com/api/3.0.0/users`

#### Headers
- `Authorization` (required): Bearer token from token endpoint
- `Content-Type`: Application/JSON for requests with body
- `Accept`: Application/JSON

#### Success Response
```json
{
  // IB API response data
}
```

#### Error Response
```json
{
  "error": "invalid_token",
  "error_description": "Session has expired"
}
```


## Error Codes

### OAuth 2.0 Errors
- `invalid_request`: Missing or invalid parameters
- `invalid_token`: Invalid or expired access token
- `invalid_grant`: Invalid refresh token
- `server_error`: Internal server error
- `authorization_pending`: Login not yet complete

### Session Errors
- `session_expired`: Session has exceeded its timeout period
- `refresh_limit_exceeded`: Maximum refresh attempts reached
- `session_invalid`: Session is no longer valid

### HTTP Status Codes
- `200`: Success
- `302`: Redirect
- `400`: Bad request
- `500`: Server error

## CORS Headers
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## State Management
### DynamoDB Tables

#### State Table (`ib-oauth-state-${stage}`)
- **Purpose**: Stores authorization state
- **Schema**:
  ```typescript
  {
    state: string,        // Partition key: polling token or auth code
    clientId: string,     // OAuth client ID
    redirectUri: string,  // Client's callback URL
    scope: string,       // OAuth scope
    ibToken: {           // IB session info
      sid: string,       // IB session ID
      content: {
        apiV3url: string, // IB API URL
        clientid: string  // IB client ID
      }
    },
    platformUrl: string, // IB platform URL
    oauthState?: string, // Original OAuth state
    expires: number      // TTL timestamp
  }
  ```
- **TTL**:
  - Polling tokens: 5 minutes
  - Auth codes: 10 minutes

#### Token Table (`ib-oauth-tokens-${stage}`)
- **Purpose**: Stores OAuth tokens and session state
- **Schema**:
  ```typescript
  {
    accessToken: string,   // Partition key
    refreshToken: string,  // GSI key
    clientId: string,     // OAuth client ID
    scope: string,       // OAuth scope
    ibToken: {           // IB session info
      sid: string,
      content: {         // Complete session info from IB
        session: {
          sid: string,
          userUuid: string,
          loginTime: number
        },
        info: {
          clientid: string,
          apiV3url: string,
          firstname: string,
          lastname: string,
          useruuid: string,
          email?: string
        }
      }
    },
    platformUrl: string,  // IB platform URL
    sidExpiry: number,   // Session expiry timestamp
    sidCreatedAt: number, // Session creation timestamp
    refreshCount: number, // Number of refresh attempts
    expires: number      // TTL timestamp
  }
  ```
- **TTL**: 1 hour for access tokens
- **Session Management**:
  - Refresh window: 5 minutes before expiry
  - Maximum refresh attempts: Configurable (default 5)
  - Session age limit: Based on logintimeoutperiod
```

## Security Considerations

### 1. CSRF & Code Interception Protection
- Use state parameter for CSRF protection
- Implement PKCE for public clients
- Validate redirect URIs
- Check origins

### 2. Token & Session Security
- Short-lived auth codes
- Secure token storage
- HTTPS only
- Session expiry enforcement
- Refresh attempt limiting
- Session age validation

### 3. Error Handling
- Don't leak sensitive info
- Validate all inputs
- Rate limiting

## Example Flow

1. Start authorization:
```http
GET /authorize
  ?response_type=code
  &client_id=test-client
  &redirect_uri=https://client.example.com/callback
  &scope=profile
  &state=random_state_123
```

2. Submit platform URL:
```http
GET /authorize
  ?platform_url=https://company.intelligencebank.com
  &client_id=test-client
  &redirect_uri=https://client.example.com/callback
  &scope=profile
  &state=random_state_123
```

3. Poll login status:
```http
GET /authorize/poll?token=polling_token_123
```

4. Exchange code:
```http
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=auth_code_xyz
&redirect_uri=https://client.example.com/callback