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

### Exchange Authorization Code
```http
POST /token
Content-Type: application/x-www-form-urlencoded
```

#### Request Body
- `grant_type` (required): Must be "authorization_code"
- `code` (required): Authorization code from callback
- `redirect_uri` (required): Must match authorization request

#### Success Response
```json
{
  "access_token": "access_token_xyz",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "refresh_token_xyz",
  "apiV3url": "https://company.intelligencebank.com/api/v3",
  "clientid": "ib_client_id",
  "sid": "ib_session_id"
}
```

#### Error Response
```json
{
  "error": "invalid_request",
  "error_description": "Invalid authorization code"
}
```

## Error Codes

### OAuth 2.0 Errors
- `invalid_request`: Missing or invalid parameters
- `server_error`: Internal server error
- `authorization_pending`: Login not yet complete

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

### Authorization State
- Stored in DynamoDB
- TTL-based cleanup
- Indexed by polling token or auth code

### Session Info
```typescript
{
  sid: string,          // IB session ID
  apiV3url: string,     // IB API URL
  clientid: string      // IB client ID
}
```

## Security Considerations

### 1. CSRF Protection
- Use state parameter
- Validate redirect URIs
- Check origins

### 2. Token Security
- Short-lived auth codes
- Secure token storage
- HTTPS only

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