# API Documentation

## Overview
This document describes the OAuth 2.0 bridge service API endpoints for IntelligenceBank authentication.

## Base URL
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}
```

## Endpoints

### Authorization Endpoint
Initiates the OAuth 2.0 authorization flow by redirecting the user to the IntelligenceBank login page.

```
GET /authorize
```

#### Query Parameters
| Parameter     | Required | Description                                     |
|--------------|----------|-------------------------------------------------|
| response_type| Yes      | Must be "code"                                  |
| client_id    | Yes      | OAuth client identifier                         |
| redirect_uri | Yes      | OAuth callback URL                              |
| scope        | Yes      | Requested scope                                 |
| state        | No       | Client state parameter                          |

#### Success Response
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: https://{ib-platform}/auth/?login=0&token={content}
  ```

#### Error Responses

1. Invalid Parameters
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: {redirect_uri}?error=invalid_request&error_description=Invalid request parameters&state={state}
  ```

2. Server Error
- **Status Code**: 302 Found
- **Headers**:
  ```
  Location: {redirect_uri}?error=server_error&error_description=Failed to process authorization request&state={state}
  ```

3. Invalid Request (without redirect_uri)
- **Status Code**: 400 Bad Request
- **Body**:
  ```json
  {
    "error": "invalid_request",
    "error_description": "Invalid request parameters"
  }
  ```

#### Example Request
```
GET /authorize?response_type=code
              &client_id=example-client
              &redirect_uri=https://client.example.com/callback
              &scope=profile
              &state=xyz123
```

#### Implementation Details
1. Initial Request:
   - Validates all OAuth parameters using zod schemas
   - Shows platform URL form if needed

2. Start Login:
   - GET /v1/auth/app/token to get initial token
   - Store state mapping with 10-minute TTL
   - Return login URL and polling token

3. Browser Login:
   - Redirect to /auth/?login=0&token={content}
   - Poll GET /v1/auth/app/info?token={content}
   - Generate authorization code when session is ready

#### Security Considerations
- All requests must use HTTPS
- State parameter is required for CSRF protection
- DynamoDB entries have TTL for automatic cleanup
- Request parameters are strictly validated
- Error responses maintain OAuth 2.0 spec compliance

### Token Endpoint
Exchange authorization code for access and refresh tokens.

```
POST /token
```

#### Request Headers
```
Content-Type: application/json
```

#### Request Body Parameters
| Parameter     | Required | Description                                     |
|--------------|----------|-------------------------------------------------|
| grant_type   | Yes      | "authorization_code" or "refresh_token"         |
| code         | Yes*     | Authorization code (for authorization_code grant)|
| refresh_token| Yes*     | Refresh token (for refresh_token grant)         |
| redirect_uri | Yes*     | Required for authorization_code grant           |
| client_id    | Yes      | OAuth client identifier                         |

*Parameter requirements depend on grant_type

#### Success Response
- **Status Code**: 200 OK
- **Body**:
  ```json
  {
    "access_token": "eyJhbGciOiJSUzI1...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "8e8620c3-4860-4358..."
  }
  ```

#### Error Responses

1. Invalid Request
- **Status Code**: 400 Bad Request
- **Body**:
  ```json
  {
    "error": "invalid_request",
    "error_description": "Invalid request parameters"
  }
  ```

2. Invalid Grant
- **Status Code**: 400 Bad Request
- **Body**:
  ```json
  {
    "error": "invalid_grant",
    "error_description": "Invalid or expired authorization code"
  }
  ```

3. Server Error
- **Status Code**: 500 Internal Server Error
- **Body**:
  ```json
  {
    "error": "server_error",
    "error_description": "An unexpected error occurred"
  }
  ```

#### Example Requests

1. Authorization Code Grant
```json
POST /token
{
  "grant_type": "authorization_code",
  "code": "abc123xyz",
  "redirect_uri": "https://client.example.com/callback",
  "client_id": "example-client"
}
```

2. Refresh Token Grant
```json
POST /token
{
  "grant_type": "refresh_token",
  "refresh_token": "8e8620c3-4860-4358...",
  "client_id": "example-client"
}
```

#### Implementation Details
- Validates request parameters using zod schemas
- Supports both authorization_code and refresh_token grants
- Generates JWT access tokens using RS256 algorithm
- Stores token mapping in DynamoDB with configurable TTL
- Implements OAuth 2.0 compliant error responses

#### Security Considerations
- All requests must use HTTPS
- JWT tokens are signed using RS256
- Access tokens have 1-hour expiry by default
- Refresh tokens have 30-day expiry by default
- One-time use authorization codes
- DynamoDB entries have TTL for automatic cleanup

### UserInfo Endpoint
Retrieve authenticated user's profile information.

```
GET /userinfo
```

#### Request Headers
```
Authorization: Bearer {access_token}
```

#### Success Response
- **Status Code**: 200 OK
- **Body**:
  ```json
  {
    "sub": "user123",
    "name": "John Doe",
    "given_name": "John",
    "family_name": "Doe",
    "email": "john.doe@example.com",
    "email_verified": true
  }
  ```

#### Error Responses

1. Missing or Invalid Token
- **Status Code**: 401 Unauthorized
- **Headers**:
  ```
  WWW-Authenticate: Bearer error="invalid_token"
  ```
- **Body**:
  ```json
  {
    "error": "Missing or invalid Authorization header"
  }
  ```

2. Expired Token
- **Status Code**: 401 Unauthorized
- **Headers**:
  ```
  WWW-Authenticate: Bearer error="invalid_token"
  ```
- **Body**:
  ```json
  {
    "error": "Token expired or invalid"
  }
  ```

3. Server Error
- **Status Code**: 500 Internal Server Error
- **Body**:
  ```json
  {
    "error": "Internal server error"
  }
  ```

#### Example Request
```
GET /userinfo
Authorization: Bearer eyJhbGciOiJSUzI1...
```

#### Implementation Details
- Validates JWT access token
- Retrieves token mapping from DynamoDB
- Gets current user session from IntelligenceBank
- Maps IB profile to standard OAuth claims
- Implements RFC 6750 error responses

#### Security Considerations
- All requests must use HTTPS
- Bearer token authentication
- JWT validation with RS256
- Standard OAuth 2.0 claims mapping
- Proper WWW-Authenticate headers